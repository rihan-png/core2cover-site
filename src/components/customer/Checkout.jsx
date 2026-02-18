"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import api from "../../api/axios";
import {
  getCart,
  clearCart,
  getSingleCheckoutItem,
  clearSingleCheckoutItem,
} from "../../utils/cart";
import Footer from "./Footer";
import { useRouter } from "next/navigation";
import "./Checkout.css";
import Navbar from "./Navbar";
import COD from "../../assets/images/COD.png";
import GooglePay from "../../assets/images/GooglePay.png";
import Paytm from "../../assets/images/Paytm.png";
import PhonePe from "../../assets/images/PhonePe.jpg";
import { getUserCredit } from "../../api/return";
import Image from "next/image";
import MessageBox from "../ui/MessageBox";
import LoadingSpinner from "../ui/LoadingSpinner";
import sample from "../../assets/images/sample.jpg";
import { FaArrowLeft, FaMapMarkerAlt, FaSearch, FaShoppingBag, FaTruckLoading, FaRulerCombined, FaTools, FaWallet } from "react-icons/fa";
import { getEncryptedStorageItem } from "../../utils/storage";

// Google Maps Imports
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";

const LIBRARIES = ["places", "maps"];

const mapContainerStyle = {
  width: "100%",
  height: "350px",
  borderRadius: "12px",
  marginTop: "15px",
  border: "1px solid rgba(0,0,0,0.1)"
};

const defaultCenter = { lat: 20.5937, lng: 78.9629 };

const formatINR = (n = 0) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function Checkout() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [markerPosition, setMarkerPosition] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [credit, setCredit] = useState(0);
  const [useCreditForFullAmount, setUseCreditForFullAmount] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "success", show: false });

  /* =========================================
      EASY ENCRYPTION HELPERS
  ========================================= */

  const triggerMsg = (text, type = "success") => setMsg({ text, type, show: true });

  const updateQty = (id, val) => {
    if (val === "") {
      setItems((prev) => prev.map((it) => (it.materialId === id ? { ...it, quantity: "" } : it)));
      return;
    }
    const newQty = Number(val);
    if (isNaN(newQty) || newQty < 0) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.materialId === id) {
          const capacity = Number(it.unitsPerTrip || 1);
          const newTrips = newQty > 0 ? Math.ceil(newQty / capacity) : 1;
          return { ...it, quantity: newQty, trips: newTrips };
        }
        return it;
      })
    );
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (!place.geometry || !place.geometry.location) return;
      const location = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setMarkerPosition(location);
      setAddress(place.formatted_address || "");
      if (mapRef.current) {
        mapRef.current.panTo(location);
        mapRef.current.setZoom(17);
      }
    }
  };

  const onMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const location = { lat, lng };
    setMarkerPosition(location);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location }, (results, status) => {
      if (status === "OK" && results[0]) setAddress(results[0].formatted_address);
    });
  }, []);

  useEffect(() => {
    const effectiveEmail = session?.user?.email || getEncryptedStorageItem("userEmail");
    if (effectiveEmail) {
      setEmail(effectiveEmail);
      api.get(`/user/${encodeURIComponent(effectiveEmail)}`)
        .then((res) => {
          setName(res.data.name || session?.user?.name || "");
          setAddress(res.data.address || "");
        }).catch(() => { });
    }

    const single = getSingleCheckoutItem();
    const rawItems = single ? [single] : getCart();

    setItems((Array.isArray(rawItems) ? rawItems : []).map((it) => ({
      ...it,
      quantity: Number(it.quantity || 1),
      trips: Number(it.trips || 1),
      amountPerTrip: Number(it.amountPerTrip || it.price || 0),
      shippingCharge: Number(it.shippingCharge ?? 0),
      // PER-SELLER DATA FROM UPDATED BACKEND
      installationCharge: Number(it.installationCharge ?? 0),
      shippingChargeType: String(it.shippingChargeType || "Paid").trim(),
      installationAvailable: String(it.installationAvailable || "no").trim().toLowerCase(),
    })));

    getUserCredit().then((res) => setCredit(Number(res.data.credit || 0))).catch(() => setCredit(0));
  }, [session, status]);

  /* CALCULATE TOTALS INCLUDING INSTALLATION */
  const computeSummary = useMemo(() => {
    let subtotal = 0, rawDeliveryCharge = 0, installationTotal = 0;

    items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      subtotal += (Number(it.amountPerTrip) * qty);

      if (it.shippingChargeType?.toLowerCase() !== "free") {
        rawDeliveryCharge += (Number(it.shippingCharge) * (Number(it.trips) || 1));
      }

      if (it.installationAvailable === "yes") {
        installationTotal += (Number(it.installationCharge) * qty);
      }
    });

    let platformCharge = subtotal > 0 ? (subtotal < 10000 ? 89 : subtotal <= 50000 ? 69 : 59) : 0;
    const finalTotal = subtotal + rawDeliveryCharge + platformCharge + installationTotal;

    return {
      subtotal,
      deliveryCharge: rawDeliveryCharge + platformCharge,
      installationTotal,
      grandTotal: finalTotal
    };
  }, [items]);

  // 1. First, add this helper outside your component or at the top of your file
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // 2. Updated handlePlaceOrder and new processOrder helper
  const handlePlaceOrder = async () => {
    const hasInvalidQty = items.some(it => !it.quantity || Number(it.quantity) <= 0);
    if (!email || !name || !address) return triggerMsg("Please provide all required details.", "error");
    if (hasInvalidQty) return triggerMsg("Please enter valid quantities for all items.", "error");

    setLoading(true);

    // Helper to call your existing /order/place API
    const processOrder = async (razorpayPaymentId = null) => {
      try {
        const res = await api.post("/order/place", {
          customerEmail: email,
          checkoutDetails: {
            name,
            address,
            paymentMethod: useCreditForFullAmount ? "store_credit" : paymentMethod,
            razorpayPaymentId // Send this to your backend for verification/records
          },
          orders: items.map(it => ({
            ...it,
            trips: it.trips,
            unit: it.unit,
            conversionFactor: it.conversionFactor,
            unitsPerTrip: it.unitsPerTrip,
            installationCharge: it.installationCharge,
            installationAvailable: it.installationAvailable
          })),
          summary: computeSummary,
          creditUsed: useCreditForFullAmount ? computeSummary.grandTotal : 0,
        });

        if (res?.data?.orderId) {
          localStorage.setItem("userEmail", btoa(email.toLowerCase().trim()));
          clearSingleCheckoutItem();
          clearCart();
          triggerMsg("Order placed successfully!", "success");
          setTimeout(() => router.push("/userprofile"), 2000);
        }
      } catch (err) {
        triggerMsg(err.response?.data?.message || "Checkout failed.", "error");
      } finally {
        setLoading(false);
      }
    };

    // Logic Switch: COD/Credit vs Online Payment
    if (paymentMethod === "cod" || useCreditForFullAmount) {
      return processOrder();
    } else {
      // RAZORPAY FLOW
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setLoading(false);
        return triggerMsg("Razorpay SDK failed to load. Please check your connection.", "error");
      }

      try {
        // Create a Razorpay Order on your server first
        // You need to create this API endpoint (e.g., /api/razorpay/create-order)
        const orderResponse = await api.post("/razorpay/create-order", {
          amount: computeSummary.grandTotal,
        });

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, // Use the public Key ID
          amount: orderResponse.data.amount,
          currency: "INR",
          name: "Core2Cover",
          description: "Payment for Order",
          order_id: orderResponse.data.id,
          handler: async function (response) {
            // If payment is successful, finalize the order in your DB
            await processOrder(
              response.razorpay_payment_id,
              response.razorpay_order_id // Pass both!
            );
          },
          prefill: {
            name: name,
            email: email,
          },
          theme: {
            color: "#4e5a44",
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            }
          }
        };

        const paymentObject = new window.Razorpay(options);
        paymentObject.open();
      } catch (err) {
        setLoading(false);
        triggerMsg("Failed to initiate online payment. Try again.", "error");
      }
    }
  };

  if (loadError) return <div className="error">Map error: {loadError.message}</div>;
  if (!isLoaded) return <LoadingSpinner message="Initialising Maps..." />;

  return (
    <>
      <Navbar />
      {loading && <LoadingSpinner message="Processing your order..." />}
      {msg.show && <MessageBox message={msg.text} type={msg.type} onClose={() => setMsg({ ...msg, show: false })} />}

      <div className="checkout-nav-bar">
        <button className="back-btn" onClick={() => router.back()}><FaArrowLeft /> Back</button>
      </div>

      <main className="checkout-page container">
        <h1 className="checkout-title">Checkout</h1>

        <div className="checkout-grid">
          <section className="checkout-left">
            {/* ITEMS REVIEW */}
            <div className="checkout-card">
              <h2><FaShoppingBag /> Review Items</h2>
              <div className="checkout-items-list">
                {items.map((item, idx) => (
                  <div key={idx} className="checkout-item">
                    <div className="checkout-item-img-container">
                      <Image src={item.image ? (item.image.startsWith('http') ? item.image : `/${item.image}`) : sample} alt="item" width={80} height={80} className="checkout-item-img" unoptimized />
                    </div>
                    <div className="checkout-item-details">
                      <h4 className="checkout-item-name">{item.name}</h4>
                      <p className="checkout-item-seller">Seller ID: {item.sellerId || item.supplierId}</p>
                      <div className="checkout-logistics-info">
                        <span><FaTruckLoading /> {item.trips} Trip(s)</span>
                        {item.installationAvailable === "yes" && (
                          <span className="installation-tag" style={{ color: '#4e5a44', fontWeight: '600' }}>
                            <FaTools /> Seller Install: {formatINR(item.installationCharge)}/unit
                          </span>
                        )}
                      </div>
                      <div className="checkout-item-meta-row">
                        <div className="checkout-qty-controls">
                          <button onClick={() => updateQty(item.materialId, item.quantity - 1)}>-</button>
                          <input type="number" value={item.quantity} readOnly />
                          <button onClick={() => updateQty(item.materialId, item.quantity + 1)}>+</button>
                        </div>
                        <span className="checkout-item-sub">{formatINR(item.amountPerTrip * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* STORE CREDIT SECTION */}
            {credit > 0 && (
              <div className="checkout-card credit-card" style={{ border: '1px solid #4e5a44', background: '#f9faf8' }}>
                <h2><FaWallet /> Store Credit</h2>
                <div className="credit-info">
                  <p>Available Balance: <strong>{formatINR(credit)}</strong></p>
                  {credit >= computeSummary.grandTotal ? (
                    <label className="credit-checkbox" style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer', marginTop: '10px' }}>
                      <input type="checkbox" style={{ width: '18px', height: '18px' }} checked={useCreditForFullAmount} onChange={(e) => setUseCreditForFullAmount(e.target.checked)} />
                      <span style={{ fontWeight: '500' }}>Pay in full using store credit</span>
                    </label>
                  ) : (
                    <p className="muted" style={{ fontSize: '0.85rem', color: '#666' }}>
                      Insufficient balance to cover the full order amount.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* CONTACT & DELIVERY */}
            <div className="checkout-card">
              <h2>Contact Information</h2>
              <div className="form-grid">
                <label className="form-row"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="form-row"><span>Email Address</span><input value={email} disabled className="disabled-input" /></label>
              </div>
            </div>

            <div className="checkout-card">
              <h2><FaMapMarkerAlt /> Delivery Location</h2>
              <div className="search-box-wrapper">
                <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={onPlaceChanged}>
                  <div className="checkout-search-inner"><FaSearch className="search-icon" /><input type="text" placeholder="Search address..." /></div>
                </Autocomplete>
              </div>
              <GoogleMap mapContainerStyle={mapContainerStyle} center={markerPosition || defaultCenter} zoom={15} onLoad={(map) => (mapRef.current = map)} onClick={onMapClick}>
                {markerPosition && <Marker position={markerPosition} />}
              </GoogleMap>
              <label className="form-row address-textarea" style={{ marginTop: "15px" }}>
                <span>Final Delivery Address</span>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Pin your location on the map..." />
              </label>
            </div>

            {!useCreditForFullAmount && (
              <div className="checkout-card">
                <h2>Payment Method</h2>
                <div className="payment-options">
                  {['cod', 'gpay', 'paytm', 'phonepe'].map(method => (
                    <button key={method} type="button" className={`payment-option ${paymentMethod === method ? "active" : ""}`} onClick={() => setPaymentMethod(method)}>
                      <Image src={method === 'cod' ? COD : method === 'gpay' ? GooglePay : method === 'paytm' ? Paytm : PhonePe} alt={method} width={40} height={25} unoptimized />
                      <span>{method === 'cod' ? "Cash on Delivery" : method.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ORDER SUMMARY */}
          <aside className="checkout-right">
            <div className="summary-card">
              <h2 className="summary-title">Order Summary</h2>
              <div className="summary-details">
                <div className="summary-row">
                  <span>Items Subtotal</span>
                  <span>{formatINR(computeSummary.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Delivery Charges</span>
                  <span>{formatINR(computeSummary.deliveryCharge)}</span>
                </div>

                {/* INSTALLATION CHARGES - FORCED VISIBLE IF > 0 */}
                {computeSummary.installationTotal > 0 && (
                  <div className="summary-row highlight-row" style={{ color: '#4e5a44', fontWeight: 'bold', borderTop: '1px dashed #ddd', paddingTop: '10px', marginTop: '5px' }}>
                    <span><FaTools style={{ marginRight: '8px' }} /> Installation Charges</span>
                    <span>{formatINR(computeSummary.installationTotal)}</span>
                  </div>
                )}
              </div>
              <hr className="summary-divider" />

              {useCreditForFullAmount && (
                <div className="summary-row credit-applied" style={{ color: '#606E52', fontWeight: '600' }}>
                  <span>Credit Applied</span>
                  <span>-{formatINR(computeSummary.grandTotal)}</span>
                </div>
              )}

              <div className="summary-row total">
                <span>Total Amount</span>
                <span>{useCreditForFullAmount ? formatINR(0) : formatINR(computeSummary.grandTotal)}</span>
              </div>

              <button className="place-order-btn" onClick={handlePlaceOrder} disabled={loading || items.length === 0}>
                {loading ? "Processing..." : "Confirm & Place Order"}
              </button>
              <p className="checkout-note">Secure encryption applied to all transactions.</p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FaStar } from "react-icons/fa";
import "./MyOrders.css";
import sample from "../../assets/images/sample.jpg";
import api from "../../api/axios";
import { cancelOrder } from "../../api/order";
import { GiSandsOfTime } from "react-icons/gi";
import { FaTruckLoading, FaRulerCombined } from "react-icons/fa";
import { requestReturn, getUserReturns, getUserCredit } from "../../api/return";
import Image from "next/image";
import LoadingSpinner from "../ui/LoadingSpinner";
import { getEncryptedStorageItem } from "../../utils/storage";

/* =========================
    STATUS HELPERS
========================= */
const getOrderStatusMeta = (status) => {
  switch (status) {
    case "pending":
      return { text: "Processing", className: "status-processing" };
    case "confirmed":
      return { text: "Confirmed", className: "status-confirmed" };
    case "out_for_delivery":
      return { text: "Out for Delivery", className: "status-out-for-delivery" };
    case "fulfilled":
      return { text: "Delivered", className: "status-delivered" };
    case "rejected":
    case "cancelled":
      return { text: "Cancelled", className: "status-cancelled" };
    default:
      return { text: "Processing", className: "status-processing" };
  }
};

const deriveReturnStatus = (r) => {
  if (!r) return null;
  const seller = (r.sellerApprovalStatus || "").toUpperCase();
  const admin = (r.adminApprovalStatus || "").toUpperCase();
  if (seller === "REJECTED" || admin === "REJECTED") return "REJECTED";
  if (seller === "APPROVED" && admin === "APPROVED") return "APPROVED";
  return "REQUESTED";
};

const getFinalOrderStatus = (orderStatus, returnInfo) => {
  if (!returnInfo) return getOrderStatusMeta(orderStatus);
  const derived = deriveReturnStatus(returnInfo);

  switch (derived) {
    case "REQUESTED":
      return { text: "Return Requested", className: "status-return-requested" };
    case "APPROVED":
      if (returnInfo.refundStatus === "COMPLETED")
        return {
          text: "Refund Completed",
          className: "status-refund-completed",
        };
      return {
        text:
          returnInfo.refundMethod === "STORE_CREDIT"
            ? "Returned (Store Credit)"
            : "Refund Processing",
        className: "status-returned",
      };
    case "REJECTED":
      return { text: "Return Rejected", className: "status-return-rejected" };
    default:
      return getOrderStatusMeta(orderStatus);
  }
};

const RETURN_REASONS = [
  "Damaged or defective product",
  "Wrong item delivered",
  "Product not as described",
];
const RETURN_LIMIT_DAYS = 2;
const MS_IN_DAY = 1000 * 60 * 60 * 24;

export default function MyOrders() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ratings, setRatings] = useState({});
  const [reviews, setReviews] = useState({});
  const [openRating, setOpenRating] = useState({});
  const [returnsMap, setReturnsMap] = useState({});
  const [returnLoading, setReturnLoading] = useState(null);
  const [returnReason, setReturnReason] = useState({});
  const [openReturnBox, setOpenReturnBox] = useState({});
  const [returnImages, setReturnImages] = useState({});
  const [refundMethod, setRefundMethod] = useState({});
  const [credit, setCredit] = useState(0);
  const [userEmail, setUserEmail] = useState(null);

  /* =========================================
      EASY ENCRYPTION HELPERS
  ========================================= */
  const decodePayload = (payload) => {
    try {
      const decodedString = atob(payload); // Decodes Base64
      return JSON.parse(decodedString);    // Parses JSON
    } catch (e) {
      console.error("Order decryption failed:", e);
      return null;
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Use secure helper to read scrambled email from storage
      const storedEmail = getEncryptedStorageItem("userEmail");
      if (storedEmail) {
        setUserEmail(storedEmail.toLowerCase().trim());
      }
    }
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    setLoadingOrders(true);
    api
      .get(`/orders/user/${encodeURIComponent(userEmail)}`)
      .then((res) => {
        // Handle potential encrypted payload from backend
        if (res.data?.payload) {
          const decodedOrders = decodePayload(res.data.payload);
          setOrders(Array.isArray(decodedOrders) ? decodedOrders : []);
        } else {
          setOrders(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        console.error("Order Fetch Error:", err);
        setOrders([]);
      })
      .finally(() => {
        setLoadingOrders(false);
      });
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    getUserReturns()
      .then((res) => {
        // Handle payload for returns too
        let rawReturns = res.data.returns || [];
        if (res.data?.payload) {
          const decoded = decodePayload(res.data.payload);
          rawReturns = decoded?.returns || [];
        }
        
        const map = {};
        rawReturns.forEach((r) => {
          map[r.orderItemId] = r;
        });
        setReturnsMap(map);
      })
      .catch(() => {});

    getUserCredit()
      .then((res) => {
        let creditVal = res.data.credit || 0;
        if (res.data?.payload) {
          const decoded = decodePayload(res.data.payload);
          creditVal = decoded?.credit || 0;
        }
        setCredit(creditVal);
      })
      .catch(() => {});
  }, [userEmail]);

  const canCancelOrder = (order) => {
    if (order.orderStatus !== "confirmed" && order.orderStatus !== "pending")
      return false;
    const orderDate = new Date(order.createdAt);
    const diffDays = (Date.now() - orderDate.getTime()) / MS_IN_DAY;
    return diffDays <= RETURN_LIMIT_DAYS;
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      await cancelOrder(orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, orderStatus: "rejected" } : o,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const submitRating = async (order) => {
    const orderItemId = order.orderItemId;
    const stars = ratings[orderItemId];
    const comment = reviews[orderItemId] || "";

    if (!stars) return;

    try {
      await api.post(`/order/item/${orderItemId}/rate`, {
        stars,
        comment,
        userEmail,
        productId: order.materialId,
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.orderItemId === orderItemId ? { ...o, isRated: true } : o,
        ),
      );
      setOpenRating((p) => ({ ...p, [orderItemId]: false }));
    } catch (err) {
      console.error("Rating Error:", err.response?.data || err.message);
      alert(
        err.response?.data?.message ||
          "Failed to submit rating. Please ensure item is delivered.",
      );
    }
  };

  const handleReturnSubmit = async (order) => {
    const reason = returnReason[order.orderItemId];
    const method = refundMethod[order.orderItemId];
    if (!reason || !method) return;

    const formData = new FormData();
    formData.append("orderItemId", order.orderItemId);
    formData.append("reason", reason);
    formData.append("refundMethod", method);
    (returnImages[order.orderItemId] || []).forEach((file) => {
      formData.append("images", file);
    });

    setReturnLoading(order.orderItemId);
    try {
      const res = await requestReturn(formData);
      let created = res.data.returnRequest || res.data;
      if (res.data?.payload) {
        created = decodePayload(res.data.payload);
      }
      setReturnsMap((prev) => ({ ...prev, [order.orderItemId]: created }));
      setOpenReturnBox((p) => ({ ...p, [order.orderItemId]: false }));
    } catch (err) {
      console.error(err);
    } finally {
      setReturnLoading(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) =>
      (o.productName || "").toLowerCase().includes(query.toLowerCase()),
    );
  }, [orders, query]);

  return (
    <div className="orders-page-container">
      {loadingOrders && (
        <div className="tab-loader-overlay">
          <LoadingSpinner message="Retrieving your orders..." />
        </div>
      )}

      {returnLoading && (
        <div className="tab-loader-overlay">
          <LoadingSpinner message="Processing return request..." />
        </div>
      )}

      <header className="orders-header-row">
        <h2 className="orders-title">Your Orders</h2>
        <div className="credit-badge">Store Credit: ₹{credit}</div>
      </header>

      <input
        className="order-search"
        placeholder="Search your orders..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="orders-lists">
        {!loadingOrders && filteredOrders.length === 0 ? (
          <div className="empty-orders-text">
            No orders found for {userEmail}.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const returnInfo = returnsMap[order.orderItemId];
            const statusMeta = getFinalOrderStatus(
              order.orderStatus,
              returnInfo,
            );
            const isDelivered = order.orderStatus === "fulfilled";
            const derivedStatus = deriveReturnStatus(returnInfo);

            const imgSrc = order.imageUrl
              ? order.imageUrl.startsWith("http")
                ? order.imageUrl
                : `/${order.imageUrl}`
              : sample.src || sample;

            return (
              <article key={order.orderItemId} className="order-card">
                <Image
                  src={imgSrc}
                  className="order-img"
                  alt={order.productName || "Product"}
                  width={100}
                  height={100}
                  style={{ objectFit: "cover" }}
                  unoptimized
                />
                <div className="order-info">
                  <div className="order-header">
                    <h3 className="order-name">{order.productName}</h3>
                    <span className={`order-status ${statusMeta.className}`}>
                      {statusMeta.text}
                    </span>
                  </div>

                  <div className="order-meta">
                    <p>
                      <strong>Order ID:</strong> {order.id}
                    </p>
                    <p>
                      <strong>Seller:</strong> {order.sellerName}
                    </p>

                    <div className="order-logistics-row">
                      <span className="log-detail">
                        <FaRulerCombined /> {order.quantity}{" "}
                        {order.unit || "units"}
                      </span>
                      <span className="log-detail">
                        <FaTruckLoading /> {order.totalTrips || 1} Trip(s)
                      </span>
                    </div>

                    <p>
                      <strong>Total:</strong> ₹{order.totalAmount}
                    </p>
                  </div>

                  {canCancelOrder(order) && (
                    <button
                      className="cancel-btn"
                      onClick={() => handleCancelOrder(order.id)}
                    >
                      Cancel Order
                    </button>
                  )}

                  {isDelivered && (
                    <section className="order-actions">
                      {returnInfo ? (
                        <div className="rated-pill">
                          {derivedStatus === "REQUESTED" && (
                            <span className="return-pending">
                              Return requested <GiSandsOfTime />
                            </span>
                          )}
                          {derivedStatus === "APPROVED" && (
                            <span className="return-approved">
                              Return approved
                            </span>
                          )}
                          {derivedStatus === "REJECTED" && (
                            <span className="return-rejected">
                              Return rejected
                            </span>
                          )}
                        </div>
                      ) : openReturnBox[order.orderItemId] ? (
                        <div className="order-rating">
                          <select
                            className="order-review"
                            value={returnReason[order.orderItemId] || ""}
                            onChange={(e) =>
                              setReturnReason((p) => ({
                                ...p,
                                [order.orderItemId]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select return reason</option>
                            {RETURN_REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <div className="refund-method">
                            <label>
                              <input
                                type="radio"
                                name={`refund-${order.orderItemId}`}
                                value="STORE_CREDIT"
                                checked={
                                  refundMethod[order.orderItemId] ===
                                  "STORE_CREDIT"
                                }
                                onChange={() =>
                                  setRefundMethod((p) => ({
                                    ...p,
                                    [order.orderItemId]: "STORE_CREDIT",
                                  }))
                                }
                              />{" "}
                              Store Credit
                            </label>
                            <label className="refund-label-spacing">
                              <input
                                type="radio"
                                name={`refund-${order.orderItemId}`}
                                value="ORIGINAL_PAYMENT"
                                checked={
                                  refundMethod[order.orderItemId] ===
                                  "ORIGINAL_PAYMENT"
                                }
                                onChange={() =>
                                  setRefundMethod((p) => ({
                                    ...p,
                                    [order.orderItemId]: "ORIGINAL_PAYMENT",
                                  }))
                                }
                              />{" "}
                              Original Payment
                            </label>
                          </div>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="order-review"
                            onChange={(e) =>
                              setReturnImages((p) => ({
                                ...p,
                                [order.orderItemId]: Array.from(e.target.files),
                              }))
                            }
                          />
                          <button
                            className="track-btn"
                            disabled={returnLoading === order.orderItemId}
                            onClick={() => handleReturnSubmit(order)}
                          >
                            {returnLoading === order.orderItemId
                              ? "Submitting..."
                              : "Confirm Return"}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="track-btn"
                          onClick={() =>
                            setOpenReturnBox((p) => ({
                              ...p,
                              [order.orderItemId]: true,
                            }))
                          }
                        >
                          Request Return
                        </button>
                      )}

                      <div className="rating-section">
                        {order.isRated ? (
                          <span className="rated-pill">✓ Rated</span>
                        ) : openRating[order.orderItemId] ? (
                          <div className="order-rating">
                            <div>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <FaStar
                                  key={star}
                                  size={18}
                                  className="rating-star-icon"
                                  style={{
                                    color:
                                      (ratings[order.orderItemId] || 0) >= star
                                        ? "#facc15"
                                        : "#d1d5db",
                                  }}
                                  onClick={() =>
                                    setRatings((p) => ({
                                      ...p,
                                      [order.orderItemId]: star,
                                    }))
                                  }
                                />
                              ))}
                            </div>
                            <textarea
                              className="order-review"
                              placeholder="Write a review..."
                              value={reviews[order.orderItemId] || ""}
                              onChange={(e) =>
                                setReviews((p) => ({
                                  ...p,
                                  [order.orderItemId]: e.target.value,
                                }))
                              }
                            />
                            <button
                              className="track-btn"
                              onClick={() => submitRating(order)}
                            >
                              Submit Review
                            </button>
                          </div>
                        ) : (
                          <button
                            className="rate-btn"
                            onClick={() =>
                              setOpenRating((p) => ({
                                ...p,
                                [order.orderItemId]: true,
                              }))
                            }
                          >
                            Rate Order
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
      <p className="end-text">End of list</p>
    </div>
  );
}
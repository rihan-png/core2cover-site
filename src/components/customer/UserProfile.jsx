"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import "./UserProfile.css";
import Navbar from "./Navbar";
import MyOrders from "./MyOrders";
import MyHiredDesigners from "./MyHiredDesigners";
import { getUserByEmail, updateUserProfile } from "../../api/user";
import { getClientHiredDesigners } from "../../api/designer";
import MessageBox from "../ui/MessageBox";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";
import LoadingSpinner from "../ui/LoadingSpinner";
import { getEncryptedStorageItem, setEncryptedStorageItem, clearStorage, isPersistentSession } from "../../utils/storage";

const libraries = ["places", "maps"];

const UserProfile = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("orders");
  const [msg, setMsg] = useState({ text: "", type: "success", show: false });
  const [designers, setDesigners] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const autocompleteRef = useRef(null);

  const [user, setUser] = useState({
    id: "", // Track the user ID in state
    name: "",
    email: "",
    phone: "",
    address: "",
    image: "" 
  });

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Identity Pinning: Priority to secure session, then secure local storage
  const effectiveEmail = useMemo(() => {
    if (status === "authenticated") return session?.user?.email;
    return getEncryptedStorageItem("userEmail");
  }, [session, status]);

  const triggerMsg = (text, type = "success") => {
    setMsg({ text, type, show: true });
  };

  useEffect(() => {
    if (status === "loading") return;

    if (!effectiveEmail && status === "unauthenticated") {
      router.push("/login");
      return;
    }

    const loadData = async () => {
      try {
        if (!effectiveEmail) return;

        const [userRes, designersRes] = await Promise.all([
          getUserByEmail(effectiveEmail),
          getClientHiredDesigners(),
        ]);

        const userData = userRes.data;
        
        /* =========================================
            ENCRYPTED LOCAL STORAGE SYNC
        ========================================= */
        const rememberMe = isPersistentSession();
        // Scrambles all sensitive markers in the Application Tab
        setEncryptedStorageItem("userId", userData?.id, rememberMe);
        setEncryptedStorageItem("userEmail", userData?.email, rememberMe);
        setEncryptedStorageItem("userName", userData?.name, rememberMe);
        if (userData?.image) setEncryptedStorageItem("userImage", userData.image, rememberMe);

        setUser({
          id: userData?.id || "",
          name: userData?.name || "",
          email: userData?.email || "",
          phone: userData?.phone || "",
          address: userData?.address || "",
          image: userData?.image || ""
        });

        setDesigners(Array.isArray(designersRes.data) ? designersRes.data : []);

        if (status === "authenticated" && (!userData?.phone || !userData?.address)) {
          setIsEditing(true);
          triggerMsg("Please complete your profile details.", "info");
        }
      } catch (err) {
        console.error("Critical Load Error:", err);
        triggerMsg("Failed to load profile data.", "error");
      }
    };

    loadData();
  }, [effectiveEmail, router, status]);

  const handlePlaceSelect = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      const address = place.formatted_address || place.name;
      setUser((prev) => ({ ...prev, address }));
    }
  };

  const handleLogout = async () => {
    // Full context wipe to remove all encrypted markers
    clearStorage();
    await signOut({ callbackUrl: "/login" });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user.phone || !user.address) {
      triggerMsg("Phone and Address are required.", "error");
      return;
    }

    try {
      const response = await updateUserProfile(effectiveEmail, {
        name: user.name,
        phone: user.phone,
        address: user.address,
      });

      const updatedUser = response.data;
      setUser(prev => ({ ...prev, ...updatedUser }));
      setIsEditing(false);
      triggerMsg("Profile updated successfully", "success");
      router.refresh();
    } catch (err) {
      triggerMsg(err.response?.data?.message || "Failed to update profile", "error");
    }
  };

  if (status === "loading") return <LoadingSpinner message="Securing your profile..." />;

  const profileImgSrc = session?.user?.image || user.image || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  return (
    <>
      <Navbar />
      {msg.show && (
        <MessageBox
          message={msg.text}
          type={msg.type}
          onClose={() => setMsg({ ...msg, show: false })}
        />
      )}
      <div className="profile-page-wrapper">
        <button onClick={() => router.back()} className="back-button">← Back</button>

        <div className="profile-info-card">
          <div className="profile-card-content">
            <div className="profile-details-column">
              
              <div className="profile-image-container">
                <Image
                  src={profileImgSrc}
                  alt="Profile"
                  width={120}
                  height={120}
                  className="user-profile-img"
                  unoptimized={true}
                  style={{ borderRadius: "50%", objectFit: "cover", border: "4px solid #fff", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}
                />
              </div>

              {isEditing ? (
                <div className="edit-form">
                  <h3>Complete Your Profile</h3>
                  <div className="input-group">
                    <label>Name</label>
                    <input type="text" name="name" value={user.name} onChange={handleChange} className="up-profile-input" />
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input type="text" name="phone" value={user.phone} onChange={handleChange} className="up-profile-input" placeholder="+91 00000 00000" />
                  </div>
                  <div className="input-group">
                    <label>Address (Your Location)</label>
                    {isLoaded ? (
                      <Autocomplete onLoad={(a) => (autocompleteRef.current = a)} onPlaceChanged={handlePlaceSelect}>
                        <input type="text" name="address" value={user.address} onChange={handleChange} className="up-profile-input" placeholder="Search for your address..." />
                      </Autocomplete>
                    ) : (
                      <input type="text" value={user.address} className="up-profile-input" disabled placeholder="Loading maps..." />
                    )}
                  </div>
                  <div className="edit-actions">
                    <button onClick={handleSave} className="up-profile-button up-save">Save Profile</button>
                    {user.phone && user.address && (
                      <button onClick={() => setIsEditing(false)} className="up-profile-button cancel">Cancel</button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="user-info-display">
                    <h2>
                      {session?.user?.name || user.name || "User"}{" "}
                      {status === "authenticated" && <span className="verified-badge">✓</span>}
                    </h2>
                    <p className="user-email">{session?.user?.email || user.email}</p>
                    <div className="contact-info">
                      <p><strong>Phone:</strong> {user.phone || "—"}</p>
                      <p><strong>Address:</strong> {user.address || "—"}</p>
                    </div>
                  </div>
                  <div className="profile-actions">
                    <button onClick={() => setIsEditing(true)} className="profile-button edit">Edit Profile</button>
                    <button onClick={handleLogout} className="profile-button logout">Logout</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="profile-tabs-container">
          <button className={`tab-btn ${activeTab === "orders" ? "active" : ""}`} onClick={() => setActiveTab("orders")}>My Orders</button>
          <button className={`tab-btn ${activeTab === "designers" ? "active" : ""}`} onClick={() => setActiveTab("designers")}>Hired Designers</button>
        </div>

        <div className="tab-content-area">
          {activeTab === "orders" ? <MyOrders /> : <MyHiredDesigners designers={designers} />}
        </div>
      </div>
    </>
  );
};

export default UserProfile;
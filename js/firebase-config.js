// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCKWtnI1vVlou_bDolcOZhEU6pbeUe8GdY",
  authDomain: "bein1-f8999.firebaseapp.com",
  projectId: "bein1-f8999",
  storageBucket: "bein1-f8999.firebasestorage.app",
  messagingSenderId: "65869697568",
  appId: "1:65869697568:web:e2ab6f80a94bdcf5fd6245",
  measurementId: "G-7F0FGXHDLH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { 
    db, 
    auth,
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
};

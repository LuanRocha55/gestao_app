// Importa as funções que você precisa dos SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, doc, addDoc, updateDoc, writeBatch, onSnapshot, getDocs, query, where, setDoc, getDoc, deleteDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

// A configuração do Firebase do seu aplicativo da web
const firebaseConfig = {
    apiKey: "AIzaSyDjktKoqi8BbLcQSkTesFCk4jUUNf_3PXY",
    authDomain: "uniateneu-nead-gestao.firebaseapp.com",
    projectId: "uniateneu-nead-gestao",
    storageBucket: "uniateneu-nead-gestao.firebasestorage.app",
    messagingSenderId: "972863464273",
    appId: "1:972863464273:web:850732d6ec8ecc3d6da970",
    measurementId: "G-CH1Z3VN9SC"
};

// Inicializa o Firebase e o Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Exporta as instâncias e funções para serem usadas em outros lugares
export { db, auth, storage, ref, uploadBytes, getDownloadURL, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification, collection, doc, addDoc, updateDoc, writeBatch, onSnapshot, getDocs, query, where, setDoc, getDoc, deleteDoc, serverTimestamp, orderBy };
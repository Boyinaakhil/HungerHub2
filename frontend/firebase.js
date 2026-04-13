// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey:import.meta.env.VITE_FIREBASE_APIKEY,
  authDomain: "hungerhub-5ca04.firebaseapp.com",
  projectId: "hungerhub-5ca04",
  storageBucket: "hungerhub-5ca04.firebasestorage.app",
  messagingSenderId: "922979993163",
  appId: "1:922979993163:web:26e48ed4a9e48ad759efce"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth=getAuth(app)
export {app,auth}
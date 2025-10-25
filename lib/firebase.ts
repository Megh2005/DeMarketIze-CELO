import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCToDKWD_GB2ikvRN5Pk7f3-vG0UvXgxF0",
    authDomain: "celo-hacks.firebaseapp.com",
    projectId: "celo-hacks",
    storageBucket: "celo-hacks.firebasestorage.app",
    messagingSenderId: "918851352143",
    appId: "1:918851352143:web:5cb0c05c05ad10fb08dc3a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };
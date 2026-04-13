import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// ✅ Correct Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587, // use TLS
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASS,
  },
  tls: {
    // ✅ Allow self-signed certificates (needed for localhost)
    rejectUnauthorized: false,
  },
});

// ✅ Function to send OTP for password reset
export const sendOtpMail = async (to, otp) => {
  try {
    await transporter.sendMail({
      from: `"HungerHub" <${process.env.EMAIL}>`,
      to,
      subject: "Reset Your Password",
      html: `<p>Your OTP for password reset is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });
    console.log(`✅ Password reset mail sent to ${to}`);
  } catch (err) {
    console.error("❌ Error sending OTP mail:", err);
    throw err;
  }
};

// ✅ Function to send delivery OTP to customer
export const sendDeliveryOtpMail = async (user, otp) => {
  try {
    await transporter.sendMail({
      from: `"HungerHub" <${process.env.EMAIL}>`,
      to: user.email,
      subject: "Delivery OTP",
      html: `<p>Your OTP for delivery is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });
    console.log(`✅ Delivery OTP mail sent to ${user.email}`);
  } catch (err) {
    console.error("❌ Error sending delivery OTP mail:", err);
    throw err;
  }
};

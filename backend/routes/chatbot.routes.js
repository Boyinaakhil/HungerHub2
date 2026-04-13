import express from 'express';
import { handleChat, handleSmartMeal } from '../controllers/chatbot.controller.js';

const router = express.Router();

router.post('/ask', handleChat);
router.post('/smart-meal', handleSmartMeal);

export default router;

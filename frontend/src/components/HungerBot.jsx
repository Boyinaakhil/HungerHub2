import React, { useState, useRef, useEffect } from 'react';
import { FaRobot, FaTimes, FaPaperPlane } from 'react-icons/fa';
import axios from 'axios';
import { serverUrl } from '../App';

const HungerBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hi! I am The Hunger Bot. How can I help you with your points, leaves, or transactions today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${serverUrl}/api/chatbot/ask`, { message: userMessage }, { withCredentials: true });
      setMessages(prev => [...prev, { sender: 'bot', text: response.data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I am having trouble connecting to the server. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {isOpen ? (
        <div className="w-80 md:w-96 bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-gray-100 transition-all duration-300 transform origin-bottom-right scale-100">
          {/* Header */}
          <div className="bg-[#ff4d2d] text-white p-4 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <FaRobot className="text-2xl" />
              <h3 className="font-bold text-lg">The Hunger Bot</h3>
            </div>
            <button onClick={toggleChat} className="text-white hover:text-gray-200 transition-colors cursor-pointer">
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="p-4 h-80 overflow-y-auto bg-gray-50 flex flex-col gap-3 scroll-smooth">
            {messages.map((msg, idx) => (
              <div key={idx} className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm ${msg.sender === 'user' ? 'bg-[#ff4d2d] text-white self-end rounded-br-none' : 'bg-white text-gray-800 self-start rounded-bl-none border border-gray-100'}`}>
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="bg-white text-gray-800 self-start shadow-sm rounded-xl rounded-bl-none border border-gray-100 p-3 text-sm flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about points, leaves..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#ff4d2d] focus:border-transparent text-sm transition-shadow"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`p-3 rounded-full text-white flex items-center justify-center transition-colors cursor-pointer ${isLoading || !input.trim() ? 'bg-gray-300' : 'bg-[#ff4d2d] hover:bg-[#e63e1f]'}`}
            >
              <FaPaperPlane className="text-sm" />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={toggleChat}
          className="w-14 h-14 bg-[#ff4d2d] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#e63e1f] hover:scale-110 transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
        >
          <FaRobot className="text-3xl group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </div>
  );
};

export default HungerBot;

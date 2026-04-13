import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipLoader } from 'react-spinners';

// Removed obsolete absolute coordinate array

const magneticParticles = [
    // Pizza
    { path: "M12 2C10.5 2 9.2 3.1 8.8 4.5l-6 15c-.2.6.2 1.3.9 1.4C10.2 21.6 17 21 21.4 19.4c.5-.2.7-.8.5-1.3l-6-15C15.5 2.5 14.5 2 13.5 2h-1.5z", ex: -250, ey: -300 },
    // Burger
    { path: "M12 3C8 3 4.5 5.5 3 9h18c-1.5-3.5-5-6-9-6zm-9 8v2h18v-2H3zm1 4c-.5 0-1 .5-1 1v1c0 2 3 4 8 4s8-2 8-4v-1c0-.5-.5-1-1-1H4z", ex: 300, ey: -200 },
    // Bowl
    { path: "M4 11h16c.6 0 1 .4 1 1s-.4 1-1 1h-1v1c0 3.3-2.7 6-6 6h-2c-3.3 0-6-2.7-6-6v-1H4c-.6 0-1-.4-1-1s.4-1 1-1zm3 0h10V9C17 7.3 15.7 6 14 6h-4C8.3 6 7 7.3 7 9v2zM6 4h12c.6 0 1-.4 1-1s-.4-1-1-1H6C5.4 2 5 2.4 5 3s.4 1 1 1z", ex: -300, ey: 250 },
    // Check/Box
    { path: "M21 5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V9c1.1 0 2-.9 2-2V5zm-2 2H5V5h14v2z", ex: 250, ey: 300 },
    // Droplet
    { path: "M12 2c0 0-5 7-5 11 0 2.8 2.2 5 5 5s5-2.2 5-5c0-4-5-11-5-11z", ex: 0, ey: -350 }
];

function SplashScreen({ showSplash }) {
    const [phase, setPhase] = useState('assemble');

    useEffect(() => {
        const pulseTimer = setTimeout(() => {
            setPhase('pulse');
        }, 3000); // 3 seconds pulse trigger
        
        return () => clearTimeout(pulseTimer);
    }, []);

    const containerVariants = {
        visible: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }
    };

    return (
        <AnimatePresence>
            {showSplash && (
                <motion.div
                    className="fixed inset-0 z-[99999] bg-gradient-to-br from-[#ff4d2d] to-[#ff6b4a] flex items-center justify-center overflow-hidden"
                    variants={containerVariants}
                    initial="visible"
                    animate="visible"
                    exit="exit"
                >
                    {/* The Background White Plate for absolute contrasting */}
                    <motion.div 
                        className="bg-white rounded-[3rem] shadow-2xl relative w-[300px] h-[160px] md:w-[450px] md:h-[220px] flex items-center justify-center z-10"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={
                            phase === 'assemble' 
                            ? { opacity: 1, scale: 1 } 
                            : { scale: [1, 1.1, 1] } 
                        }
                        transition={{ 
                            opacity: { duration: 1, ease: "easeOut" },
                            scale: { type: "spring", bounce: 0.4, duration: 1 },
                            ...(phase === 'pulse' && { duration: 0.6, ease: "easeInOut", repeat: 0 })
                        }}
                    >
                        {/* Assembled Fragment Logo Container using NATIVE FLEXBOX to ensure absolute perfection */}
                        <div className="flex items-center justify-center shrink-0">
                            {/* The giant H */}
                            <motion.div
                                initial={{ x: -400, y: -300, opacity: 0, rotate: -45, scale: 0.5 }}
                                animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                                transition={{ duration: 1.5, type: "spring", bounce: 0.15, delay: 0.1 }}
                            >
                                <span className="text-[#ff4d2d] drop-shadow-xl text-[8rem] md:text-[14rem] font-serif italic leading-none block -mr-2 md:-mr-4" style={{ fontFamily: '"Times New Roman", Times, serif' }}>H</span>
                            </motion.div>

                            {/* The Right Column Text */}
                            <div className="flex flex-col justify-center mt-2 md:mt-4">
                                <motion.div
                                    initial={{ x: 400, y: -400, opacity: 0, rotate: 45, scale: 0.5 }}
                                    animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                                    transition={{ duration: 1.5, type: "spring", bounce: 0.15, delay: 0.2 }}
                                >
                                <span
                                className="text-black text-[4rem] md:text-[6rem] tracking-tighter leading-[0.8] block"
                                style={{ fontFamily: 'Arial, sans-serif' }}
                                >
                                <span className="inline-block ml-1 md:ml-2">u</span>
                                <span>nger</span>
                                </span>                                
                                </motion.div>
                                
                                <div className="flex items-center gap-2 mt-1 md:mt-2">
                                    <motion.div
                                        initial={{ x: -300, y: 400, opacity: 0, rotate: -90, scale: 0.5 }}
                                        animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                                        transition={{ duration: 1.5, type: "spring", bounce: 0.15, delay: 0.3 }}
                                    >
                                        <span className="text-black text-[4rem] md:text-[6rem] tracking-tighter leading-[0.8] block ml-1 md:ml-2" style={{ fontFamily: 'Arial, sans-serif' }}>ub</span>
                                    </motion.div>

                                    <motion.div
                                        initial={{ x: 400, y: 300, opacity: 0, rotate: 90, scale: 0.5 }}
                                        animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                                        transition={{ duration: 1.5, type: "spring", bounce: 0.15, delay: 0.4 }}
                                    >
                                        <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800 opacity-90 md:w-[70px] md:h-[70px]">
                                            <ellipse cx="12" cy="16" rx="10" ry="4" fill="#f3f4f6" />
                                            <path d="M12 11c-2-1-4-1-6 0M18 11c-2-1-4-1-6 0" />
                                            <path d="M4 16c0 1 3 3 8 3s8-2 8-3" />
                                            <path d="M10 5s.5-2 2-2 2 2 2 2" strokeWidth="1"/>
                                            <path d="M14 6s.5-2 2-2 2 2 2 2" strokeWidth="1"/>
                                        </svg>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Exploding & Magnetic Food Particles */}
                    {magneticParticles.map((particle, i) => (
                        <motion.div
                            key={`magnetic-${i}`}
                            className="absolute text-white/50 drop-shadow-xl z-20 pointer-events-none"
                            initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                            // The Magnetic Animation Loop: Starts center -> Explodes Outward -> Sucks Back In -> Disappears
                            animate={{ 
                                x: [0, particle.ex, 0], 
                                y: [0, particle.ey, 0], 
                                scale: [0, 1.5, 0], 
                                opacity: [0, 1, 0],
                                rotate: [0, 180, 360]
                            }}
                            transition={{
                                duration: 2.2, // Fast explosion, delayed suck-back
                                times: [0, 0.4, 1], // Timing markers for frames
                                ease: "easeInOut",
                                delay: 0.2
                            }}
                        >
                            <svg width="45" height="45" viewBox="0 0 24 24" fill="currentColor">
                                <path d={particle.path} />
                            </svg>
                        </motion.div>
                    ))}
                    
                    {/* Scene 2 Shockwave / Heartbeat Ripple behind container */}
                    {phase === 'pulse' && (
                        <motion.div
                            className="absolute w-[350px] h-[350px] bg-white/40 rounded-[4rem] pointer-events-none z-[5]"
                            initial={{ scale: 1, opacity: 0.8 }}
                            animate={{ scale: 5, opacity: 0 }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                        />
                    )}

                    {/* Loader at bottom */}
                    <motion.div className="absolute bottom-[10%] flex flex-col items-center gap-3">
                        <ClipLoader color="white" size={35} />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default SplashScreen;

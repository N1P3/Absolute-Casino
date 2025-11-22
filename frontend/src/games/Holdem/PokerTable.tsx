import React from "react";

const PokerTable: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
    return (
        <svg
            viewBox="0 0 1380 840"
            className={className}
            style={style}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                {/* Rail Gradient - Simulates leather curvature */}
                <linearGradient id="railGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2a1a10" />
                    <stop offset="15%" stopColor="#5c3a22" />
                    <stop offset="40%" stopColor="#3d2616" />
                    <stop offset="80%" stopColor="#1a0f08" />
                    <stop offset="100%" stopColor="#0d0704" />
                </linearGradient>

                {/* Rail Highlight - Top shine */}
                <linearGradient id="railHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                    <stop offset="20%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>

                {/* Felt Gradient - Radial lighting with more depth */}
                <radialGradient id="feltGradient" cx="50%" cy="50%" r="60%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="#0f5e36" />
                    <stop offset="60%" stopColor="#0a4527" />
                    <stop offset="90%" stopColor="#06331e" />
                    <stop offset="100%" stopColor="#021a0d" />
                </radialGradient>

                {/* Gold Gradient for Logo */}
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#bf953f" />
                    <stop offset="25%" stopColor="#fcf6ba" />
                    <stop offset="50%" stopColor="#b38728" />
                    <stop offset="75%" stopColor="#fbf5b7" />
                    <stop offset="100%" stopColor="#aa771c" />
                </linearGradient>

                {/* Inner Shadow for the rail depth */}
                <filter id="innerShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feComponentTransfer in="SourceAlpha">
                        <feFuncA type="table" tableValues="1 0" />
                    </feComponentTransfer>
                    <feGaussianBlur stdDeviation="8" />
                    <feOffset dx="0" dy="4" result="offsetblur" />
                    <feFlood floodColor="rgba(0,0,0,0.8)" result="color" />
                    <feComposite in2="offsetblur" operator="in" />
                    <feComposite in2="SourceAlpha" operator="in" />
                    <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode />
                    </feMerge>
                </filter>

                {/* Drop Shadow for the whole table */}
                <filter id="tableShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="20" />
                    <feOffset dx="0" dy="20" result="offsetblur" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.7" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Main Group with Drop Shadow */}
            <g filter="url(#tableShadow)">
                {/* 1. The Rail (Outer Rim) */}
                <rect
                    x="20"
                    y="20"
                    width="1340"
                    height="800"
                    rx="400"
                    ry="400"
                    fill="url(#railGradient)"
                    stroke="#1a0f08"
                    strokeWidth="2"
                />

                {/* Rail Shine/Highlight Overlay */}
                <rect
                    x="30"
                    y="30"
                    width="1320"
                    height="780"
                    rx="390"
                    ry="390"
                    fill="none"
                    stroke="url(#railHighlight)"
                    strokeWidth="15"
                    opacity="0.6"
                />

                {/* 2. The Felt (Playing Surface) */}
                {/* Inset by about 60px for the rail thickness */}
                <rect
                    x="80"
                    y="80"
                    width="1220"
                    height="680"
                    rx="340"
                    ry="340"
                    fill="url(#feltGradient)"
                    filter="url(#innerShadow)" // Adds depth where felt meets rail
                />

                {/* 3. Betting Line / Decorations */}
                <rect
                    x="250"
                    y="220"
                    width="880"
                    height="400"
                    rx="200"
                    ry="200"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2"
                    strokeDasharray="10,10"
                />

                {/* Center Logo / Decoration */}
                <g opacity="0.8" transform="translate(690, 420)">
                    <circle cx="0" cy="0" r="90" fill="none" stroke="url(#goldGradient)" strokeWidth="3" opacity="0.5" />
                    <circle cx="0" cy="0" r="85" fill="none" stroke="url(#goldGradient)" strokeWidth="1" opacity="0.3" />

                    <text x="0" y="10" textAnchor="middle" fill="url(#goldGradient)" fontFamily="serif" fontSize="32" fontWeight="bold" letterSpacing="4" style={{ textShadow: "0px 2px 4px rgba(0,0,0,0.5)" }}>ABSOLUTE</text>
                    <text x="0" y="40" textAnchor="middle" fill="url(#goldGradient)" fontFamily="sans-serif" fontSize="14" letterSpacing="8" fontWeight="300" style={{ textShadow: "0px 2px 4px rgba(0,0,0,0.5)" }}>CASINO</text>

                    <path d="M -50 -25 L 50 -25" stroke="url(#goldGradient)" strokeWidth="1" opacity="0.6" />
                    <path d="M -50 55 L 50 55" stroke="url(#goldGradient)" strokeWidth="1" opacity="0.6" />

                    {/* Decorative suit symbols */}
                    <text x="-70" y="5" fill="url(#goldGradient)" fontSize="20" opacity="0.4">♠</text>
                    <text x="70" y="5" fill="url(#goldGradient)" fontSize="20" opacity="0.4">♥</text>
                    <text x="0" y="-60" textAnchor="middle" fill="url(#goldGradient)" fontSize="20" opacity="0.4">♣</text>
                    <text x="0" y="75" textAnchor="middle" fill="url(#goldGradient)" fontSize="20" opacity="0.4">♦</text>
                </g>
            </g>
        </svg>
    );
};

export default PokerTable;

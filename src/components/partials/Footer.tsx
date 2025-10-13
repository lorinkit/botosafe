import React from "react";

const Footer: React.FC = () => {
  return (
    <footer
      className="py-8 px-6 shadow-inner overflow-hidden"
      style={{
        background: "linear-gradient(90deg, #3A86FF 0%, #5F6CAF 100%)",
        color: "white",
      }}
    >
      {/* Decorative curved top edge */}
      <div className="absolute left-0 right-0 top-0 w-full h-8 pointer-events-none z-20">
        <svg
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <path
            d="M0,10 Q50,-10 100,10 L100,0 L0,0 Z"
            fill="url(#footerGradient)"
          />
          <defs>
            <linearGradient
              id="footerGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#3A86FF" />
              <stop offset="100%" stopColor="#5F6CAF" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-2">
        {/* Logo/Brand */}
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl font-black tracking-tight text-white">
            BOTOSAFE
          </h2>
        </div>

        {/* Tagline */}
        <p className="text-base italic font-medium text-white">
          &quot;Safe na safe boto mo&quot;
        </p>

        {/* Copyright */}
        <p className="text-sm text-white mt-2">
          &copy; 2025 BOTOSAFE. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;

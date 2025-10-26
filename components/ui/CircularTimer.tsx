"use client";
import React from "react";

const CircularTimer = ({ time, totalTime }: { time: number; totalTime: number }) => {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = time / totalTime;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle
          className="text-gray-700"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
        />
        <circle
          className="text-green-400"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-2xl font-bold">{Math.floor(time / 1000)}s</p>
      </div>
    </div>
  );
};

export default CircularTimer;

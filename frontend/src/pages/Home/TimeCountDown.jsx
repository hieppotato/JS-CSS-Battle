import React, { useState, useEffect } from "react";

const TimeLeftClock = ({ initialTime }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer); // Cleanup on unmount
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ fontSize: "2rem", textAlign: "center", margin: "20px" }}>
      {timeLeft > 0 ? (
        <p>Time Left: {formatTime(timeLeft)}</p>
      ) : (
        <p>Time's up!</p>
      )}
    </div>
  );
};

export default TimeLeftClock;

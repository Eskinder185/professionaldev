import { useEffect, useState } from "react";

const quotes = [
  "Growth happens just outside your comfort zone.",
  "Done is better than perfect — iterate.",
  "Small daily progress beats occasional bursts."
];

export default function QuoteWidget(){
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentQuote = quotes[currentQuoteIndex];
    let charIndex = 0;
    
    const typeInterval = setInterval(() => {
      if (charIndex < currentQuote.length) {
        setDisplayedText(currentQuote.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        
        // Wait a bit before starting to erase
        setTimeout(() => {
          setIsTyping(false);
          const eraseInterval = setInterval(() => {
            if (charIndex > 0) {
              setDisplayedText(currentQuote.slice(0, charIndex - 1));
              charIndex--;
            } else {
              clearInterval(eraseInterval);
              setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
              setIsTyping(true);
            }
          }, 50); // Erase speed
        }, 2000); // Wait time before erasing
      }
    }, 100); // Typing speed

    return () => clearInterval(typeInterval);
  }, [currentQuoteIndex]);

  return (
    <div className="italic text-gray-700 min-h-[1.5rem]">
      {displayedText}
      {isTyping && <span className="animate-pulse">|</span>}
    </div>
  )
}

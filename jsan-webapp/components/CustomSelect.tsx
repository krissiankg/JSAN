"use client";
import React, { useState, useRef, useEffect } from 'react';

interface Option {
  label: string;
  value: string;
  dataLink: string;
}

interface CustomSelectProps {
  id: string;
  options: Option[];
  onChangeCategory: string;
}

export default function CustomSelect({ id, options, onChangeCategory }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    setIsOpen(false);
    
    const opt = options[idx];
    const mockSelectElement = {
      options: options.map(o => ({
        value: o.value,
        getAttribute: (attr: string) => attr === 'data-link' ? o.dataLink : null
      })),
      selectedIndex: idx
    };
    
    if (typeof window !== 'undefined' && (window as any).updatePrice) {
      (window as any).updatePrice(onChangeCategory, mockSelectElement);
    }
  };

  return (
    <div className="custom-select-wrapper" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        className="ticket-select" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          userSelect: 'none',
          background: 'var(--white)',
          padding: '12px 14px',
          border: isOpen ? '1px solid var(--green-primary)' : '1px solid var(--gray)',
          borderRadius: '8px',
          boxShadow: isOpen ? '0 0 0 3px rgba(46, 125, 50, 0.1)' : '0 2px 5px rgba(0,0,0,0.05)',
        }}
      >
        <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '10px'}}>{options[selectedIdx].label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 292.4 292.4" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path fill="#2e7d32" d="M287 69.4a17.6 17.6 0 0 0-13-5.4H18.4c-5 0-9.3 1.8-12.9 5.4A17.6 17.6 0 0 0 0 82.2c0 5 1.8 9.3 5.4 12.9l128 127.9c3.6 3.6 7.8 5.4 12.8 5.4s9.2-1.8 12.8-5.4L287 95c3.5-3.5 5.4-7.8 5.4-12.8 0-5-1.9-9.2-5.5-12.8z"/>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          background: 'var(--white)', 
          border: '1px solid var(--gray)', 
          zIndex: 9999, 
          borderRadius: '8px', 
          overflow: 'hidden', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)', 
          marginTop: '6px' 
        }}>
          {options.map((opt, i) => (
            <div 
              key={i} 
              style={{ 
                padding: '12px 16px', 
                borderBottom: i === options.length - 1 ? 'none' : '1px solid #f0f0f0', 
                cursor: 'pointer', 
                background: selectedIdx === i ? 'var(--green-pale)' : 'var(--white)', 
                color: selectedIdx === i ? 'var(--green-dark)' : 'var(--text-dark)',
                fontWeight: selectedIdx === i ? 600 : 400,
                fontSize: '0.95rem'
              }}
              onClick={() => handleSelect(i)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

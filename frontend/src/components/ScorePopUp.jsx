import React from 'react';
// THÊM: Import file CSS
import './ScoreDisplay.css'; 

/**
 * ScoreDisplay (Đã chỉnh sửa từ ScorePopup)
 * Hiển thị điểm số cố định ở góc trên bên phải và hoạt động như một button.
 *
 * Props:
 * - score: number | string
 * - size: 'sm' | 'md' | 'lg'
 * - onClick: () => void (Optional: Thêm hành động khi click)
 */
export default function ScoreDisplay({
  score,
  size = 'md',
  onClick = () => {},
}) {
  
  const sizes = {
    sm: { padding: 'px-4 py-2', text: 'text-lg', sub: 'text-xs' }, // Padding ngang 4, dọc 2
    md: { padding: 'px-6 py-3', text: 'text-2xl', sub: 'text-sm' }, // Padding ngang 6, dọc 3
    lg: { padding: 'px-8 py-4', text: 'text-4xl', sub: 'text-base' }, // Padding ngang 8, dọc 4
  };
  const s = sizes[size] || sizes.md;

  return (
    <>
      {/* SỬA ĐỔI:
        Loại bỏ các class Tailwind tĩnh, thay bằng class từ file CSS
      */}
      <button
        type="button"
        onClick={onClick}
        role="status"
        aria-live="polite"
        className="score-display-button" 
      >
        <div className="score-orb-wrapper"> 
          {/* SỬA ĐỔI:
            Thay thế class Tailwind bằng `score-orb`
            GIỮ LẠI: class size động: ${s.w} ${s.h}
          */}
          <div 
            className={`score-orb ${s.padding}`}
          >
            <div className="score-text-content">
              {/* SỬA ĐỔI:
                GIỮ LẠI: class size động: ${s.text}
              */}
              <div className={`score-text-number ${s.text}`}>{score}</div>
              
              {/* SỬA ĐỔI:
                GIỮ LẠI: class size động: ${s.sub}
              */}
              <div className={`score-text-label ${s.sub}`}>Điểm</div>
            </div>
          </div>
        </div>
      </button>

      {/* XÓA: <style> tag đã được chuyển sang file .css */}
    </>
  );
}
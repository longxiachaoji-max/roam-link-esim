import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#16162A',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 22V18" stroke="#00D4FF" strokeWidth="3" strokeLinecap="round"/>
          <path d="M16 22V10" stroke="#FF4E6A" strokeWidth="3" strokeLinecap="round"/>
          <path d="M24 22V6" stroke="#00D4FF" strokeWidth="3" strokeLinecap="round"/>
          <path d="M5 16C5 11.2201 8.24357 7.1512 12.6397 5.76007" stroke="#FFD93D" strokeWidth="2" strokeLinecap="round"/>
          <path d="M27 16C27 20.7799 23.7564 24.8488 19.3603 26.2399" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    ),
    { ...size }
  )
}
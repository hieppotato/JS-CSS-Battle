import React, { use, useEffect, useState } from 'react'
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Home = ({puzzles}) => {
  const navigate = (e) => {
    window.location.href = e;
  };  

  return (
    <div>
      <h1 className='text-white'>Available Puzzles</h1>
      <ul>
        {puzzles.map((puzzle) => (
          <li key={puzzle.id}>
            <button className='text-white cursor-pointer' onClick={() => navigate(`/puzzle-game/${puzzle.id}`)}>Play Puzzle</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Home
import React, { use, useEffect, useState } from 'react'
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [puzzles, setPuzzles] = useState([]);

  useEffect(() => { 
    const fetchPuzzles = async () => {
      try {
        const response = await axiosInstance.get('/puzzles');
        setPuzzles(response.data);
        console.log('Puzzles fetched:', response.data);
      } catch (error) {
        console.error('Error fetching puzzles:', error);
      } 
    };

    fetchPuzzles();
  }, []);

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
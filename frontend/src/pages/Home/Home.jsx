import React, { use, useEffect, useState } from 'react'
import axiosInstance from '../../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {   
        const res = await axiosInstance.get(`/questions`);
        setQuestions(res.data);
      }
      catch (error) {
        console.error("Error fetching questions:", error);
      }
    };
    fetchQuestions();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Danh sách câu hỏi</h1>
      <ul>
        {questions.map((question) => (  
          <li key={question.id} className="mb-2 p-4 border rounded-lg hover:shadow-lg cursor-pointer">
            <h2 className="text-xl font-semibold">{question.title}</h2>
            <p className="text-gray-600" onClick={() => navigate(`/contest/${question.id}`)}>ID: {question.id}</p>
            <div className="mt-2">  
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Home
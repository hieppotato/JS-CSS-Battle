import { use, useContext, useEffect, useState } from 'react'
import '../../styles/main.css'
import "./PuzzleGame.css"

import Navbar from '../../components/Navbar.jsx'
import PuzzleFormContainer from '../../components/PuzzleFormContainer.jsx'
import PersonalisedPuzzleContainer from '../../components/PersonalisedPuzzleContainer.jsx'
import Footer from '../../components/Footer.jsx'
import ScorePopup from '../../components/ScorePopUp.jsx'
import CrosswordContainer from '../../components/CrosswordContainer.jsx'
import ColorConfiguration from '../../components/ColorConfiguration.jsx'
import { AppContext } from '../../AppProvider.jsx'
import { useParams } from 'react-router-dom'

// Main App component that renders the entire application.
// It includes the Navbar, main container with crossword progress, crossword puzzle, puzzle form, references, personalized puzzle container, footer, and color configuration.
function PuzzleGame({userInfo}) {
  const [scoreFromServer, setScoreFromServer] = useState(null);
  // console.log("User Info in PuzzleGame:", userInfo);
    const puzzleId = useParams().id;
  const { refs, answers, setShowAnswers } = useContext(AppContext)
  const [crossword, setCrossword] = useState(0) // State to restart the crossword puzzle
  const restartCrossword = () => {
    setShowAnswers(false) // Hide answers when restarting
    setCrossword(crossword + 1) // Increment to trigger a re-render
  }

  useEffect(() => {
    setScoreFromServer(userInfo?.point ?? userInfo?.score ?? null);
  }, [userInfo]); 

  return (
    <>
      {/* Navigation Bar */}
      <div className="puzzle-page" id="mainContainer">
        <div className="m-2"></div>
        <CrosswordContainer setScoreFromServer={setScoreFromServer} key={crossword} puzzleId={puzzleId} userInfo={userInfo}/>
        <ScorePopup
            visible={true}
            score={scoreFromServer ?? userInfo?.point ?? userInfo?.score ?? '—'}
            position="bottom-right"
            showBackdrop={false}
            size="md"
        />
      </div >
    </>
  )
}

export default PuzzleGame

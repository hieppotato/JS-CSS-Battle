import { use, useContext, useEffect, useState } from 'react'
import '../../styles/main.css'

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
      <div className="container-fluid" id="mainContainer">
        <div className="crossword-container d-flex flex-column">
          
          <div className="h-100 d-flex align-items-center justify-content-center">
            <div className="progress" style={{ width: '60%' }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar"
                aria-label="Animated striped example" style={{ width: '0%' }} aria-valuenow="21" aria-valuemin="0"
                aria-valuemax="35"></div>
            </div>
          </div>
        </div>


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
      
      {/* Footer */}

    </>
  )
}

export default PuzzleGame

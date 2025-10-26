import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../AppProvider';
import CustomPuzzleUsingJSON from './CustomPuzzleUsingJSON';
import axiosInstance from '../utils/axiosInstance';
import './style.css'; // ✅ import file CSS riêng

const PersonalisedPuzzleContainer = () => {
    const { vword } = useContext(AppContext);
    const [vwordInput, setVwordInput] = useState(vword.toUpperCase());
    const [trueVwordInput, setTrueVwordInput] = useState('');
    const [currForm, setCurrForm] = useState();
    const [jsonForm, setJsonForm] = useState();
    const [showJsonText, setShowJsonText] = useState(false);

    const handleGenerateForm = () => {
        if (vwordInput) {
            const jsonData = {
                vword: vwordInput.toUpperCase(),
                refs: Array(vwordInput.length).fill(0).map((_, i) => `Referencia ${i + 1}`),
                answers: Array(vwordInput.length).fill(0).map((_, i) => `Palabra ${i + 1}`)
            };
            setJsonForm(JSON.stringify(jsonData, null, 2));
            setCurrForm(<PersonalisedPuzzleForm key={vwordInput} {...{ trueVwordInput, vwordInput, setShowJsonText }} />);
        } else {
            alert('Something went wrong... Did you load the vertical word?');
            setCurrForm(undefined);
        }
    };

    return (
        <div className="puzzle-container">
            <h3 className="puzzle-title">Tạo ô chữ</h3>

            <form className="puzzle-form">
                <div className="puzzle-row">
                    <input
                        type="text"
                        className="puzzle-input"
                        placeholder="Từ hàng dọc lộn xộn"
                        value={vwordInput}
                        onChange={(e) => setVwordInput(e.target.value.toUpperCase())}
                    />
                    <input
                        type="text"
                        className="puzzle-input"
                        placeholder="Từ hàng dọc chuẩn"
                        value={trueVwordInput}
                        onChange={(e) => setTrueVwordInput(e.target.value.toUpperCase())}
                    />
                    <button type="button" className="btn btn-primary puzzle-btn" onClick={handleGenerateForm}>
                        🚀 Start!
                    </button>
                </div>

                {currForm}
            </form>

            <CustomPuzzleUsingJSON jsonForm={jsonForm} setJsonForm={setJsonForm} showJsonText={showJsonText} />
        </div>
    );
};

const PersonalisedPuzzleForm = ({ trueVwordInput, vwordInput, setShowJsonText }) => {
    const { setVword, setAnswers } = useContext(AppContext);
    const [inputAnswers, setInputAnswers] = useState(Array(vwordInput.length).fill(''));

    useEffect(() => {
        setInputAnswers(Array(vwordInput.length).fill(''));
    }, [vwordInput]);

    const savePuzzle = async (vwordInput, inputAnswers) => {
        try {
            await axiosInstance.post('/save-puzzle', {
                vword: vwordInput,
                answers: inputAnswers,
                true_vword : trueVwordInput
            });
            alert('Puzzle saved successfully');
        } catch (error) {
            console.error('Error saving puzzle:', error);
            alert('Failed to save puzzle. Please try again.');
        }
    };

    const generateCustomCrossword = () => {
        setVword(vwordInput);
        setAnswers(inputAnswers);
        savePuzzle(vwordInput, inputAnswers);
    };

    const handleAnswerInputChange = (e, idx) => {
        const newAnswers = [...inputAnswers];
        newAnswers[idx] = e.target.value;
        setInputAnswers(newAnswers);
    };

    return (
        <div className="puzzle-generator">
            {vwordInput.split('').map((char, i) => (
                <div key={i} className="puzzle-row">
                    <input
                        type="text"
                        className="puzzle-input"
                        placeholder={`Word containing "${char}" (answer #${i + 1})`}
                        value={inputAnswers[i]}
                        onChange={(e) => handleAnswerInputChange(e, i)}
                    />
                </div>
            ))}

            <div className="puzzle-btn-group">
                <button
                    type="button"
                    className="btn btn-secondary puzzle-btn"
                    onClick={() => setShowJsonText(true)}
                >
                    Generate with JSON
                </button>
                <button
                    type="button"
                    className="btn btn-primary puzzle-btn"
                    onClick={generateCustomCrossword}
                >
                    Ready! Generate Crossword
                </button>
            </div>
        </div>
    );
};

export default PersonalisedPuzzleContainer;

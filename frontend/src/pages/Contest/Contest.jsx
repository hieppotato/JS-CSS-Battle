import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import ScorePopup from '../../components/ScorePopUp';

/**
 * Single editor textarea (reused for HTML/CSS/JS)
 */
function EditorPanel({ value, onChange, language }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full p-3 border text-black border-gray-300 rounded-b-lg resize-none font-mono text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
      spellCheck="false"
      data-lang={language}
    />
  );
}

function BuyImagePanel({ image, questionData, userInfo }) {

  // console.log('User info in BuyImagePanel:', userInfo);
  // console.log('Question data in BuyImagePanel:', questionData);

  const [isBought, setIsBought] = useState(userInfo?.images.includes(questionData.answer_css) || false);
  const [imgeUrl, setImageUrl] = useState(image || "");
  const handleBuy = async () => {
    try{
      const response = await axiosInstance.put('/buy-image', {
        userId: userInfo?.id,
        imageCost: 2 * questionData?.difficulty,
        image_url: questionData?.answer_css,
        userPoint: userInfo?.point || 0,
      });
      if (response.data) {
        setIsBought(true);
        alert('Mua hình ảnh thành công!');
      } else {
        alert('Mua hình ảnh thất bại: ' + (response.data.error || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Lỗi khi mua hình ảnh:', error);
      alert('Lỗi khi mua hình ảnh: ' + error.message);

    }
  };

  useEffect(() => {
    setIsBought(userInfo?.images.includes(questionData?.answer_css) || false);
    setImageUrl(questionData?.answer_css || "");
  }, [userInfo, questionData]);

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-white h-full flex flex-col">
      <img src={imgeUrl} alt="Hình ảnh gợi ý" className="mb-4 max-h-100 max-w-100" />
      {isBought ? (
        <div className="text-green-600 font-semibold">Bạn đã mua hình ảnh này.</div>  
      ) : 
      (<div><div className="text-gray-800">Mua hình ảnh để xem gợi ý thiết kế.</div>
        <button
          onClick={() => handleBuy()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
        >
          Mua hình ảnh ({2 * questionData?.difficulty} điểm)
        </button>
      </div>
      )}
      
    </div>
  );
}

function LiveHtmlPlayground({ questionId, userInfo }) {
  const [showScorePopup, setShowScorePopup] = useState(true);
  const [scoreFromServer, setScoreFromServer] = useState(null);

  const [html, setHtml] = useState('');
  const [css, setCss] = useState(
    'body {\n  font-family: sans-serif;\n  background-color: #f0f4f8;\n  color: #333;\n  padding: 1rem;\n}\n\nh1 {\n  color: #007bff;\n}'
  );
  const [js, setJs] = useState(
    '// Gõ code JavaScript ở đây\nconsole.log("Playground đã tải");\n'
  );

  const [srcDoc, setSrcDoc] = useState('');
  const [questionData, setQuestionData] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  const [lastSavedHtml, setLastSavedHtml] = useState(null);

  // tab index: 0 = HTML, 1 = CSS, 2 = JS
  const [activeTab, setActiveTab] = useState(0);

  // Fetch question template + latest saved code
  useEffect(() => {
    const fetchQuestions = async (id) => {
      if (!id) return;
      try {
        const response = await axiosInstance.get(`/questions/${id}`);
        setQuestionData(response.data);
        // console.log('Fetched question data:', response.data);
        if (!lastSavedHtml) {
          setHtml(response.data.template_html || '');
        }
      } catch (error) {
        console.error('Error fetching question data:', error);
      }
    };

    const fetchSavedCode = async (question_id, user_id) => {
      if (!question_id || !user_id) return;
      try {
        const response = await axiosInstance.get('/saved_code', {
          params: { question_id, user_id },
        });
        if (response.data && response.data.saved_html) {
          setHtml(response.data.saved_html);
          setLastSavedHtml(response.data.saved_html);
        }
      } catch (error) {
        console.error('Error fetching saved code:', error);
      }
    };

    const qid = questionId?.contestId;
    const uid = userInfo?.id || userInfo?.userId || userInfo?._id;
    fetchQuestions(qid);
    fetchSavedCode(qid, uid);
    setScoreFromServer(userInfo?.point ?? userInfo?.score ?? null);
  }, [questionId?.contestId, userInfo?.id, userInfo?.userId, userInfo?._id]); // eslint-disable-line

  // Preview iframe
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSrcDoc(`
        <html>
          <head>
            <style>${css}</style>
          </head>
          <body>
            ${html}
            <script>${js}</script>
          </body>
        </html>
      `);
    }, 500);

    return () => clearTimeout(timeout);
  }, [html, css, js]);

  // saveCode
  const saveCode = useCallback(
    async (opts = {}) => {
      const payload = {
        question_id: questionId?.contestId || opts.question_id || null,
        user_id: userInfo?.id || userInfo?.userId || userInfo?._id || opts.user_id || null,
        saved_html: html,
      };

      if (!payload.question_id) {
        console.warn('Không có question_id — bỏ qua lưu.');
        return { ok: false, message: 'missing question_id' };
      }
      if (!payload.user_id) {
        console.warn('Không có user_id — bỏ qua lưu.');
        return { ok: false, message: 'missing user_id' };
      }

      setSaveStatus('saving');
      try {
        const res = await axiosInstance.post('/saved_code', payload);
        setSaveStatus('saved');
        setLastSavedHtml(html);

        // nếu server trả điểm thì show popup với điểm đó
        const score = res?.data?.score ?? userInfo?.point ?? userInfo?.score ?? null;
        setScoreFromServer(score);
        setShowScorePopup(true);

        setTimeout(() => setSaveStatus(''), 1800);
        return { ok: true, data: res.data };
      } catch (err) {
        console.error('Lỗi khi lưu code:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(''), 2500);
        return { ok: false, error: err };
      }
    },
    [html, questionId?.contestId, userInfo]
  );

  // Ctrl/Cmd + S listener
  useEffect(() => {
    const onKeyDown = async (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();

        await saveCode();
      }

      // optionally switch tab with Ctrl+1/2/3
      if (ctrlOrCmd && e.key >= '1' && e.key <= '3') {
        const idx = Number(e.key) - 1;
        setActiveTab(idx);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [saveCode]);

  const isDirty = useMemo(() => {
    if (lastSavedHtml === null) {
      return html !== '';
    }
    return html !== lastSavedHtml;
  }, [html, lastSavedHtml]);

  // Indicator dot (only show on HTML tab header)
  const indicator = (
    <div className="flex items-center space-x-2">
      <div
        title={
          saveStatus === 'saving'
            ? 'Đang lưu...'
            : saveStatus === 'saved'
            ? 'Đã lưu'
            : saveStatus === 'error'
            ? 'Lưu thất bại'
            : isDirty
            ? 'Chưa lưu'
            : 'Đã lưu'
        }
        className={`w-3 h-3 rounded-full border ${
          saveStatus === 'saving'
            ? 'bg-yellow-400 border-yellow-500 animate-pulse'
            : saveStatus === 'error'
            ? 'bg-red-600 border-red-700'
            : isDirty
            ? 'bg-red-500 border-red-700'
            : 'bg-green-500 border-green-700'
        }`}
      />
    </div>
  );

  // Tab labels
  const tabs = [
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'js', label: 'JS' },
    { id: 'image', label: 'Image' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen text-black bg-gray-100 font-sans">
      {/* Left column: tabbed editor */}
      <div className="flex flex-col w-full md:w-1/2 h-1/2 md:h-full p-2">
        {/* Tabs header */}
        <div className="flex items-center bg-gray-900 text-sm text-gray-200 rounded-t-lg overflow-hidden select-none">
          {tabs.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-4 py-2 focus:outline-none ${
                activeTab === idx
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
              }`}
              aria-pressed={activeTab === idx}
              aria-controls={`editor-panel-${t.id}`}
            >
              <span className="font-mono text-xs tracking-wider">{t.label}</span>
              {/* show indicator only on HTML label */}
              {t.id === 'html' && <span className="ml-2">{indicator}</span>}
            </button>
          ))}
          {/* spacer + small save hint */}
          <div className="ml-auto pr-3 text-xs text-gray-400 hidden sm:block">
            Nhấn <kbd className="px-1 py-0.5 border rounded bg-black/20">Ctrl/Cmd</kbd> + <kbd className="px-1 py-0.5 border rounded bg-black/20">S</kbd> để lưu
          </div>
        </div>

        {/* Editor area with slide */}
          <div className="relative flex-1 bg-white border border-t-0 rounded-b-lg overflow-hidden">
            {/* IMPORTANT: container width = 300% (3 panels), panels each w-full
                We must translate by 0%, 100%, 200% accordingly. */}
            <div
              className="flex h-full w-[300%] transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeTab * 100}%)` }}
              aria-live="polite"
            >
              {/* each panel takes 1/3 of the wide container; because container is 300% and each child is w-full,
                  each child will equal 100% of the viewport area (one panel visible at a time) */}
              <div id="editor-panel-html" className="flex-shrink-0 w-full p-2 h-full">
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <EditorPanel value={html} onChange={setHtml} language="html" />
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="mr-2">HTML</span>
                    {isDirty ? <span className="text-red-600">Có thay đổi chưa lưu</span> : <span>Đã lưu</span>}
                  </div>
                </div>
              </div>

              <div id="editor-panel-css" className="flex-shrink-0 w-full p-2 h-full">
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <EditorPanel value={css} onChange={setCss} language="css" />
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="mr-2">CSS</span>
                  </div>
                </div>
              </div>

              <div id="editor-panel-js" className="flex-shrink-0 w-full p-2 h-full">
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <EditorPanel value={js} onChange={setJs} language="javascript" />
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="mr-2">JavaScript</span>
                  </div>
                </div>
              </div>

              <div id="editor-panel-image" className="flex-shrink-0 w-full p-2 h-full">
                <div className="h-full flex flex-col">
                  <div className="flex-1">
                    <BuyImagePanel image={questionData?.answer_css} questionData={questionData} userInfo={userInfo} />
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="mr-2">Hình ảnh gợi ý</span>
                  </div>
                </div>
              </div>

              
            </div>
          </div>


        {/* small status row */}
        <div className="mt-2 text-sm text-gray-600">
          {saveStatus === 'saving' && <span>Đang lưu… (Ctrl/Cmd+S)</span>}
          {saveStatus === 'saved' && <span className="text-green-600">Đã lưu ✓</span>}
          {saveStatus === 'error' && <span className="text-red-600">Lưu thất bại</span>}
          {!saveStatus && isDirty && <span className="text-red-600">Có thay đổi chưa lưu</span>}
          {!saveStatus && !isDirty && <span>Không có thay đổi</span>}
        </div>
      </div>

      {/* Right column: preview */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full p-2">
        <div className="w-full h-full bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
          <div className="flex h-full">
            {/* result / console header imitation */}
            <div className="w-1/10 bg-gray-100 border-r border-gray-200 p-2 hidden md:flex items-center justify-center text-sm text-gray-600">
              Result
            </div>
            <div className="flex-1 p-2">
              <iframe
                srcDoc={srcDoc}
                title="Preview"
                sandbox="allow-scripts"
                className="w-full h-full bg-white rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Score popup */}
      <ScorePopup
        visible={true}
        score={scoreFromServer ?? userInfo?.point ?? userInfo?.score ?? '—'}
        onClose={() => setShowScorePopup(false)}
        position="bottom-right"
        showBackdrop={false}
        size="md"
      />
    </div>
  );
}

const Contest = ({ userInfo }) => {
  const id = useParams();
  return <LiveHtmlPlayground questionId={id} userInfo={userInfo} />;
};

export default Contest;

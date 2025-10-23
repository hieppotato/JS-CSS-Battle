import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

function BuyImagePanel({ image, questionData, userInfo, setScoreFromServer }) {
  const [isBought, setIsBought] = useState(false);
  const [imgeUrl, setImageUrl] = useState(image || null);

  const handleBuy = async () => {
    try {
      const response = await axiosInstance.put('/buy-image', {
        userId: userInfo?.id,
        imageCost: 2 * questionData?.difficulty,
        image_url: questionData?.answer_css,
        userPoint: userInfo?.point || 0,
      });
      if (response.data) {
        setIsBought(true);
        // server returns updated profile maybe inside response.data.profile or similar
        const returnedPoint = response.data?.profile?.point ?? response.data?.point ?? null;
        setScoreFromServer(returnedPoint);
        alert('Mua hình ảnh thành công!');
      } else {
        alert('Mua hình ảnh thất bại: ' + (response.data?.error || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Lỗi khi mua hình ảnh:', error);
      alert('Lỗi khi mua hình ảnh: ' + (error?.message || error));
    }
  };

  useEffect(() => {
    // safe-check images array (userInfo.images can be jsonb / array / undefined)
    if (userInfo?.images && questionData?.answer_css) {
      try {
        const imgs = Array.isArray(userInfo.images)
          ? userInfo.images
          : typeof userInfo.images === 'string'
          ? JSON.parse(userInfo.images)
          : userInfo.images;
        setIsBought(Array.isArray(imgs) && imgs.includes(questionData.answer_css));
      } catch (e) {
        setIsBought(false);
      }
    } else {
      setIsBought(false);
    }
    setImageUrl(questionData?.answer_css || null);
  }, [userInfo, questionData]);

  return (
    <div className="p-4 border border-gray-300 rounded-lg bg-white h-full flex flex-col">
      {isBought && imgeUrl && (
        <img src={imgeUrl} alt="Hình ảnh gợi ý" className="mb-4 max-h-100 max-w-100" />
      )}
      {isBought ? (
        <div className="text-green-600 font-semibold">Bạn đã mua hình ảnh này.</div>
      ) : (
        <div>
          <div className="text-gray-800">Mua hình ảnh để xem gợi ý thiết kế.</div>
          <button
            onClick={() => handleBuy()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
          >
            Mua hình ảnh ({2 * (questionData?.difficulty || 0)} điểm)
          </button>
        </div>
      )}
    </div>
  );
}

function LiveHtmlPlayground({ questionId, userInfo }) {
  
  const [scoreFromServer, setScoreFromServer] = useState(null);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState(
    'body {\n  font-family: sans-serif;\n  background-color: #f0f4f8;\n  color: #333;\n  padding: 1rem;\n}\n\nh1 {\n  color: #007bff;\n}'
  );
  const [js, setJs] = useState('// Gõ code JavaScript ở đây\nconsole.log("Playground đã tải");\n');

  const [srcDoc, setSrcDoc] = useState('');
  const [questionData, setQuestionData] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'
  const [lastSavedHtml, setLastSavedHtml] = useState(null);
  const [loading, setLoading] = useState(true);

  // tab index: 0 = HTML, 1 = CSS, 2 = JS, 3 = Image
  const [activeTab, setActiveTab] = useState(0);

  // Fetch question template + latest saved code together to avoid race
  useEffect(() => {
    const controller = new AbortController();
    const qid = questionId?.contestId;
    const uid = userInfo?.id || userInfo?.userId || userInfo?._id;

    const fetchBoth = async () => {
      setLoading(true);
      try {
        // if no qid, nothing to fetch
        if (!qid) {
          setLoading(false);
          return;
        }

        // start both requests in parallel
        const questionPromise = axiosInstance.get(`/questions/${qid}`, {
          signal: controller.signal,
        });

        const savedPromise = uid
          ? axiosInstance.get('/saved_code', {
              params: { question_id: qid, user_id: uid },
              signal: controller.signal,
            })
          : Promise.resolve({ data: null });

        const [questionRes, savedRes] = await Promise.all([questionPromise, savedPromise]);

        if (controller.signal.aborted) return;

        const qData = questionRes?.data ?? null;
        setQuestionData(qData);

        // decide which html to use: saved has priority (even empty string is valid)
        const saved_html =
          savedRes?.data && (typeof savedRes.data === 'object') ? savedRes.data.saved_html : null;

        if (saved_html !== null && saved_html !== undefined) {
          // saved exists (could be empty string) -> use it
          setHtml(saved_html);
          setLastSavedHtml(saved_html);
        } else {
          // fallback to template_html (may be undefined -> default '')
          const template = qData?.template_html ?? '';
          setHtml(template);
          // lastSavedHtml stays null (meaning no saved version)
          setLastSavedHtml(null);
        }

        // optionally prefill css/js from question if present (keep existing defaults if not)
        if (qData?.template_css) setCss(qData.template_css);
        if (qData?.template_js) setJs(qData.template_js);

        // set score from userInfo snapshot (if any)
        setScoreFromServer(userInfo?.point ?? userInfo?.score ?? null);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching question/saved:', err);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchBoth();

    return () => {
      controller.abort();
    };
    // include userInfo id because saved_code depends on it
  }, [questionId?.contestId, userInfo?.id, userInfo?.userId, userInfo?._id]); // eslint-disable-line

  // Preview iframe (debounced)
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
        // prefer server-returned saved_html if provided; otherwise use current html
        const serverSavedHtml = res?.data?.saved_html;
        const newSavedHtml = serverSavedHtml !== undefined ? serverSavedHtml : html;

        setSaveStatus('saved');
        setLastSavedHtml(newSavedHtml);

        // if server returns updated point or score, use it
        const score = res?.data?.score ?? userInfo?.point ?? userInfo?.score ?? null;
        setScoreFromServer(score);

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

  // Ctrl/Cmd + S listener and Ctrl+1/2/3 for tab switching
  useEffect(() => {
    const onKeyDown = async (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        await saveCode();
      }

      if (ctrlOrCmd && e.key >= '1' && e.key <= '4') {
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
    // if lastSavedHtml is null => no saved version exists; consider dirty only if html differs from template default
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
                activeTab === idx ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
              }`}
              aria-pressed={activeTab === idx}
              aria-controls={`editor-panel-${t.id}`}
            >
              <span className="font-mono text-xs tracking-wider">{t.label}</span>
              {t.id === 'html' && <span className="ml-2">{indicator}</span>}
            </button>
          ))}
          <div className="ml-auto pr-3 text-xs text-gray-400 hidden sm:block">
            Nhấn <kbd className="px-1 py-0.5 border rounded bg-black/20">Ctrl/Cmd</kbd> + <kbd className="px-1 py-0.5 border rounded bg-black/20">S</kbd> để lưu
          </div>
        </div>

        {/* Editor area with slide */}
        <div className="relative flex-1 bg-white border border-t-0 rounded-b-lg overflow-hidden">
          <div
            className="flex h-full w-[400%] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeTab * 100}%)` }}
            aria-live="polite"
          >
            <div id="editor-panel-html" className="flex-shrink-0 w-full p-2 h-full">
              <div className="h-full flex flex-col">
                <div className="flex-1">
                  {/* show skeleton while loading to avoid flicker */}
                  {loading ? (
                    <div className="h-full w-full animate-pulse bg-gray-50 border border-gray-200 rounded" />
                  ) : (
                    <EditorPanel value={html} onChange={setHtml} language="html" />
                  )}
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
                  {loading ? (
                    <div className="h-full w-full animate-pulse bg-gray-50 border border-gray-200 rounded" />
                  ) : (
                    <EditorPanel value={css} onChange={setCss} language="css" />
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <span className="mr-2">CSS</span>
                </div>
              </div>
            </div>

            <div id="editor-panel-js" className="flex-shrink-0 w-full p-2 h-full">
              <div className="h-full flex flex-col">
                <div className="flex-1">
                  {loading ? (
                    <div className="h-full w-full animate-pulse bg-gray-50 border border-gray-200 rounded" />
                  ) : (
                    <EditorPanel value={js} onChange={setJs} language="javascript" />
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <span className="mr-2">JavaScript</span>
                </div>
              </div>
            </div>

            <div id="editor-panel-image" className="flex-shrink-0 w-full p-2 h-full">
              <div className="h-full flex flex-col">
                <div className="flex-1">
                  <BuyImagePanel
                    image={questionData?.answer_css}
                    questionData={questionData}
                    userInfo={userInfo}
                    setScoreFromServer={(e) => setScoreFromServer(e)}
                  />
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
            <div className="w-1/10 bg-gray-100 border-r border-gray-200 p-2 hidden md:flex items-center justify-center text-sm text-gray-600">
              Result
            </div>
            <div className="flex-1 p-2">
              {/* only render iframe when srcDoc is ready to avoid flicker */}
              <iframe
                srcDoc={srcDoc || '<!doctype html>'}
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

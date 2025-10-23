import React, { useEffect, useState } from "react";
import axiosInstance from "../../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import { TextInput, ScrollArea, Table, Text, UnstyledButton, Group, Center, Pagination } from "@mantine/core";
import { IconSearch, IconChevronDown, IconChevronUp, IconSelector } from "@tabler/icons-react";

const TopicCard = ({ topic, isSelected, onSelect }) => (
    <div
        onClick={() => onSelect(topic.image_url)}
        className={`px-4 py-5 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-between ${
            isSelected
                ? 'bg-[#C6E7FF] border-[#0367B0]'
                : 'bg-white border-gray-200 hover:border-[#0367B0] hover:bg-gray-50'
        }`}
    >
        <p className={`font-medium text-sm ${isSelected ? 'text-[#112D4E]' : 'text-gray-700'}`}>{topic.filename}</p>
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ml-3 ${isSelected ? 'bg-[#0367B0] border-[#0367B0]' : 'border-gray-300'}`}>
            {isSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </div>
    </div>
);

const CreateContest = () => {
    const [contestName, setContestName] = useState("");
    const [images, setImages] = useState([]);
    const [filteredImages, setFilteredImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());;
    const [search, setSearch] = useState("");

    const [activePage, setActivePage] = useState(1);
    const pageSize = 8;

    useEffect(() => {
    const fetchImages = async () => {
      try {
        const res = await axiosInstance.get(`/images`);
        setImages(res.data);
        setFilteredImages(res.data);
      } catch (error) {
        console.error("Error fetching topics:", error);
      }
    };
    fetchImages();
  }, []);

  const handleSearchChange = (event) => {
    const value = event.currentTarget.value;
    setSearch(value);

    const query = value.toLowerCase().trim();
    const results = images.filter((t) =>
      String(t.filename).toLowerCase().includes(query)
    );

    setFilteredImages(results);
    setActivePage(1); // reset về trang đầu khi search
  };


  const handleSelectImages = (imageId) => {
      setSelectedImages(prev => {
          const newSet = new Set(prev);
          if (newSet.has(imageId)) {
              newSet.delete(imageId);
          } else {
              newSet.add(imageId);
          }
          return newSet;
      });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!contestName.trim()) {
      alert("Vui lòng nhập tên bài kiểm tra!");
      return;
  }
  if (selectedImages.size === 0) {
      alert("Vui lòng chọn ít nhất một chủ đề!");
      return;
  }

  try {
      // Lọc image_url từ selectedImages, tìm image chứa 'root_image'
      const rootImage = images.find(
          (img) => selectedImages.has(img.image_url) && img.image_url.includes("/root_image")
      );
      console.log("Root Image:", rootImage.image_url);
      const answer_css = rootImage.image_url;

      await axiosInstance.post("/create-question", {
          title: contestName,
          images: Array.from(selectedImages),
          answer_css : answer_css, // lưu image_url chứa 'root_image'
      });
  } catch (error) {
      console.error("Error creating contest:", error);
      alert("Failed to create contest!");
  }
};


  // tính dữ liệu theo trang
  const startIndex = (activePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedImages = filteredImages.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredImages.length / pageSize);

  return (
    <div className="bg-gray-50 overflow-hidden mt-4 lexend min-h-screen-102vh">
      <main className="max-w-8xl mx-auto p-4 sm:p-8 main-content">
        <div className="container mx-auto">
          <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#112D4E]">Tạo câu hỏi mới</h1>
              <div className="w-24 h-1 bg-[#0367B0] mt-2 rounded-full"></div>
          </div>

          <form>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Cột thông tin bên trái */}
                  <div className="lg:col-span-1 bg-white rounded-xl shadow-lg h-fit overflow-hidden border border-gray-200">
                      <div className="bg-[#0367B0] p-4">
                          <h2 className="text-lg font-semibold text-white">Thông tin</h2>
                      </div>
                      <div className="p-6">
                          <div className="space-y-6">
                              <div>
                                  <label htmlFor="contest-name" className="block text-sm font-medium text-[#112D4E] mb-2">Tên bài kiểm tra</label>
                                  <input
                                      type="text"
                                      id="contest-name"
                                      value={contestName}
                                      onChange={(e) => setContestName(e.target.value)}
                                      placeholder="Ví dụ: Kiểm tra giữa kì I"
                                      className="w-full text-black px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C6E7FF] focus:border-[#0367B0] transition"
                                      required
                                  />
                              </div>
                              <div>
                              </div>
                              <div>
                                  <label htmlFor="search-topics" className="block text-sm font-medium text-[#112D4E] mb-2">Tìm kiếm ảnh</label>
                                  <div className="relative">
                                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                          <IconSearch />
                                      </span>
                                      <input
                                          type="search"
                                          id="search-imageNames"
                                          value={search}
                                          onChange={handleSearchChange}
                                          placeholder="Nhập tên chủ đề..."
                                          className="w-full pl-10 pr-4 py-2 text-black border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C6E7FF] focus:border-[#0367B0] transition"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Lưới chọn chủ đề bên phải */}
                  <div className="lg:col-span-2 bg-white rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
                      <div className="bg-[#0367B0] p-4">
                          <h2 className="text-lg font-semibold text-white">Chọn chủ đề ({selectedImages.size})</h2>
                      </div>

                      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto p-6" style={{ minHeight: '400px' }}>
                          {paginatedImages.length > 0 ? (
                              paginatedImages.map((topic) => (
                                  <TopicCard
                                      key={topic.image_url}
                                      topic={topic}
                                      isSelected={selectedImages.has(topic.image_url)}
                                      onSelect={handleSelectImages}
                                  />
                              ))
                          ) : (
                              <div className="md:col-span-2 flex items-center justify-center text-gray-500">
                                  Không tìm thấy chủ đề nào.
                              </div>
                          )}
                      </div>

                      {/* Phân trang */}
                      {/* Pagination */}

                    {filteredImages.length > pageSize && (
                      <div className="flex justify-center items-center space-x-2 flex-shrink-0 p-6 border-t-1 border-gray-200 bg-gray-50/50">
                        <Pagination
                          total={Math.ceil(filteredImages.length / pageSize)}
                          value={activePage}
                          onChange={setActivePage}
                          color="#0367B0"
                        />
                      </div>
                    )}
                  </div>
              </div>

              {/* Nút tạo bài kiểm tra */}
              <div className="mt-8 flex justify-end lg:fixed lg:bottom-8 lg:left-60 lg:mt-0">
                  <button onClick={handleSubmit} type="submit" className="bg-[#0367B0] cursor-pointer text-white font-bold py-3 px-8 rounded-lg hover:bg-opacity-90 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg">
                      Tạo bài kiểm tra
                  </button>
              </div>
          </form>
      </div>
      </main>
    </div>
  );
};

export default CreateContest;
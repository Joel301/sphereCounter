import React, { useState, useEffect, useCallback, useRef } from 'react';

const App = () => {
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [params, setParams] = useState({
    minDist: 10,
    param1: 100,
    param2: 20,
    minRadius: 3,
    maxRadius: 50,
  });
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);

  // Load OpenCV.js
  useEffect(() => {
    if (window.cv) {
      window.cv.onRuntimeInitialized = () => {
        console.log('OpenCV.js is ready');
      };
    } else {
      console.error('OpenCV.js failed to load');
    }
  }, []);

  // Handle file selection and processing
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setError('Please select an image');
      return;
    }
    setImage(file);
    setImageUrl(URL.createObjectURL(file)); // Temporary URL for display
    setCount(0);
    setError('');
    processImage(); // Process immediately
  };

  // Handle parameter changes
  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setParams((prev) => ({
      ...prev,
      [name]: parseInt(value, 10) || prev[name],
    }));
  };

  // Process image with OpenCV.js
  const processImage = useCallback(() => {
    if (!imageUrl || !window.cv || !canvasRef.current || !originalCanvasRef.current || !image) {
      setError('Image or OpenCV.js not loaded');
      return;
    }

    const imgElement = new Image();
    imgElement.src = imageUrl;
    imgElement.crossOrigin = 'Anonymous';
    imgElement.onload = () => {
      // Draw original image on left canvas
      const originalCanvas = originalCanvasRef.current;
      const origCtx = originalCanvas.getContext('2d');
      originalCanvas.width = imgElement.width;
      originalCanvas.height = imgElement.height;
      origCtx.drawImage(imgElement, 0, 0);

      const canvas = document.createElement('canvas');
      canvas.width = imgElement.width;
      canvas.height = imgElement.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0);

      try {
        const src = window.cv.imread(canvas);
        const gray = new window.cv.Mat();
        const circles = new window.cv.Mat();

        // Convert to grayscale
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Apply stronger Gaussian blur
        window.cv.GaussianBlur(gray, gray, { width: 7, height: 7 }, 0, 0);

        // Adaptive thresholding for better edge detection
        const thresh = new window.cv.Mat();
        window.cv.adaptiveThreshold(
          gray,
          thresh,
          255,
          window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          window.cv.THRESH_BINARY_INV,
          11,
          2
        );

        // Detect circles using dynamic parameters
        window.cv.HoughCircles(
          thresh,
          circles,
          window.cv.HOUGH_GRADIENT,
          1,
          params.minDist || (gray.rows / 16),
          params.param1 || 100,
          params.param2 || 20,
          params.minRadius || 3,
          params.maxRadius || 50
        );

        // Draw circles on the image
        const output = src.clone();
        for (let i = 0; i < circles.cols; ++i) {
          const x = circles.data32F[i * 3];
          const y = circles.data32F[i * 3 + 1];
          const radius = circles.data32F[i * 3 + 2];
          window.cv.circle(output, { x, y }, Math.round(radius), [0, 255, 0, 255], 2); // Green circle
          window.cv.circle(output, { x, y }, 2, [0, 0, 255, 255], 3); // Red center dot
        }

        // Draw count text
        window.cv.putText(
          output,
          `Circles: ${circles.cols}`,
          { x: 10, y: 30 },
          window.cv.FONT_HERSHEY_SIMPLEX,
          1,
          [255, 255, 255, 255],
          2
        );

        // Convert back to canvas
        window.cv.imshow(canvasRef.current, output);
        setCount(circles.cols);

        // Clean up
        src.delete();
        gray.delete();
        thresh.delete();
        circles.delete();
        output.delete();
      } catch (err) {
        console.error('OpenCV processing error:', err);
        setError('Error processing image');
      }
    };
    imgElement.onerror = () => {
      console.error('Image failed to load:', imageUrl);
      setError('Failed to load image for processing');
    };
  }, [imageUrl, params, image]);

  // Process image when imageUrl or params change
  useEffect(() => {
    if (imageUrl) {
      processImage();
    }
  }, [imageUrl, processImage, params]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6">Contador de esferas</h1>
      <div className="bg-white p-6 rounded shadow-md w-full max-w-4xl">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mb-4 w-full"
        />
        {error && <p className="text-red-500 mt-2">{error}</p>}
        {imageUrl && (
          <div className="flex flex-row justify-between mt-4">
            {/* Left Column - Original Image */}
            <div className="w-1/3 pr-4">
              <canvas
                ref={originalCanvasRef}
                className="w-full h-auto"
                style={{ border: '1px solid #ccc' }}
              />
            </div>
            {/* Center Column - Advanced Settings */}
            <div className="w-1/3 px-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
              >
                {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
              </button>
              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <label className="block mb-2">Min Distance: <input type="number" name="minDist" value={params.minDist} onChange={handleParamChange} className="w-full p-1 border" /></label>
                  <label className="block mb-2">Edge Detection Threshold: <input type="number" name="param1" value={params.param1} onChange={handleParamChange} className="w-full p-1 border" /></label>
                  <label className="block mb-2">Circle Detection Sensitivity: <input type="number" name="param2" value={params.param2} onChange={handleParamChange} className="w-full p-1 border" /></label>
                  <label className="block mb-2">Min Radius: <input type="number" name="minRadius" value={params.minRadius} onChange={handleParamChange} className="w-full p-1 border" /></label>
                  <label className="block mb-2">Max Radius: <input type="number" name="maxRadius" value={params.maxRadius} onChange={handleParamChange} className="w-full p-1 border" /></label>
                </div>
              )}
            </div>
            {/* Right Column - Processed Image */}
            <div className="w-1/3 pl-4">
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ border: '1px solid #ccc' }}
              />
              <p className="text-lg mt-2 text-center">
                Detected Circles: <span className="font-bold">{count}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
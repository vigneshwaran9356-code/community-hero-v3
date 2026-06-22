// YOUR GEMINI API KEY
const API_KEY = "my api key";

// Show image preview when user selects photo
document.getElementById('issuePhoto')
  .addEventListener('change', function(e) {
  
  const file = e.target.files[0];
  const preview = document.getElementById('preview');
  
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  }
});

// Main submit function
async function submitReport() {
  const photoFile = document.getElementById('issuePhoto').files[0];
  const description = document.getElementById('description').value;
  
  if (!photoFile) {
    alert("Please upload a photo of the issue!");
    return;
  }
  
  // Show loading
  document.getElementById('category').value = "🤖 AI is analyzing...";
  
  // Convert image to base64
  const base64Image = await convertToBase64(photoFile);
  
  // Send to Gemini AI
  const aiResult = await analyzeWithGemini(base64Image, description);
  
  // Show result
  showResult(aiResult);
}

// Convert image file to base64
function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove "data:image/jpeg;base64," prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Send image to Gemini API
async function analyzeWithGemini(base64Image, userDescription) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            },
            {
              text: `Analyze this community issue image. 
              User description: "${userDescription}"
              
              Reply ONLY with this JSON format:
              {
                "category": "pothole/water_leakage/broken_light/garbage/other",
                "severity": "low/medium/high/critical",
                "description": "what you see in the image",
                "action": "who should fix this",
                "priority": 7
              }`
            }
          ]
        }]
      })
    }
  );
  
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  // Clean and parse JSON
  const cleanText = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanText);
}

// Display AI result on screen
function showResult(result) {
  document.getElementById('category').value = result.category;
  
  const resultBox = document.getElementById('result-box');
  resultBox.innerHTML = `
    <p><strong>Category:</strong> ${result.category}</p>
    <p><strong>Severity:</strong> ${result.severity}</p>
    <p><strong>Description:</strong> ${result.description}</p>
    <p><strong>Action Needed:</strong> ${result.action}</p>
    <p><strong>Priority Score:</strong> ${result.priority}/10</p>
  `;
  
  document.getElementById('ai-result').style.display = 'block';
}
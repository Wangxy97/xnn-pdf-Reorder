// 初始化PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// 全局变量
let currentPDF = null;
let pdfPages = [];
let imageFiles = [];

// 标签切换功能
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
    });
});

// PDF文件上传处理
document.getElementById('pdf-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPDF = await pdfjsLib.getDocument(arrayBuffer).promise;
        pdfPages = [];
        
        // 清空预览区域
        const previewContainer = document.getElementById('pdf-preview');
        previewContainer.innerHTML = '';

        // 生成所有页面的缩略图
        for (let i = 1; i <= currentPDF.numPages; i++) {
            const page = await currentPDF.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const thumbnail = document.createElement('div');
            thumbnail.className = 'page-thumbnail';
            thumbnail.dataset.pageNumber = i;
            
            thumbnail.innerHTML = `
                <img src="${canvas.toDataURL()}" alt="Page ${i}">
                <span class="page-number">${i}</span>
                <button class="delete-btn" onclick="deletePage(${i})">删除</button>
            `;
            
            previewContainer.appendChild(thumbnail);
            pdfPages.push({
                pageNumber: i,
                canvas: canvas
            });
        }

        // 初始化拖拽排序
        new Sortable(previewContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost'
        });

    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('PDF加载失败，请重试！');
    }
});

// 删除页面
function deletePage(pageNumber) {
    const thumbnail = document.querySelector(`.page-thumbnail[data-page-number="${pageNumber}"]`);
    if (thumbnail) {
        thumbnail.remove();
        pdfPages = pdfPages.filter(page => page.pageNumber !== pageNumber);
    }
}

// 处理页码顺序
async function processPageOrder() {
    const orderInput = document.getElementById('page-order').value;
    if (!orderInput || !currentPDF) return;

    const order = orderInput.split('').map(num => parseInt(num));
    const previewContainer = document.getElementById('pdf-preview');
    previewContainer.innerHTML = '';

    // 重新排序页面
    for (const pageNum of order) {
        if (pageNum > 0 && pageNum <= currentPDF.numPages) {
            const page = await currentPDF.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.3 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const thumbnail = document.createElement('div');
            thumbnail.className = 'page-thumbnail';
            thumbnail.dataset.pageNumber = pageNum;
            
            thumbnail.innerHTML = `
                <img src="${canvas.toDataURL()}" alt="Page ${pageNum}">
                <span class="page-number">${pageNum}</span>
                <button class="delete-btn" onclick="deletePage(${pageNum})">删除</button>
            `;
            
            previewContainer.appendChild(thumbnail);
        }
    }

    // 重新初始化拖拽排序
    new Sortable(previewContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost'
    });
}

// 下载处理后的PDF
async function downloadPDF() {
    if (!currentPDF || pdfPages.length === 0) {
        alert('请先上传PDF文件！');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const filename = document.getElementById('output-filename').value || 'processed_document';

    // 获取当前页面顺序
    const pageOrder = Array.from(document.querySelectorAll('.page-thumbnail'))
        .map(thumb => parseInt(thumb.dataset.pageNumber));

    // 按顺序添加页面
    for (let i = 0; i < pageOrder.length; i++) {
        if (i > 0) pdf.addPage();
        
        const page = await currentPDF.getPage(pageOrder[i]);
        const viewport = page.getViewport({ scale: 1.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save(`${filename}.pdf`);
}

// 图片上传处理
document.getElementById('image-upload').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    imageFiles = files;
    
    const previewContainer = document.getElementById('image-preview');
    previewContainer.innerHTML = '';

    files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'page-thumbnail';
            thumbnail.dataset.index = index;
            
            thumbnail.innerHTML = `
                <img src="${e.target.result}" alt="Image ${index + 1}">
                <span class="page-number">${index + 1}</span>
                <button class="delete-btn" onclick="deleteImage(${index})">删除</button>
            `;
            
            previewContainer.appendChild(thumbnail);
        };
        reader.readAsDataURL(file);
    });

    // 初始化拖拽排序
    new Sortable(previewContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost'
    });
});

// 删除图片
function deleteImage(index) {
    const thumbnail = document.querySelector(`.page-thumbnail[data-index="${index}"]`);
    if (thumbnail) {
        thumbnail.remove();
        imageFiles = imageFiles.filter((_, i) => i !== index);
    }
}

// 转换图片为PDF
async function convertImagesToPDF() {
    if (imageFiles.length === 0) {
        alert('请先上传图片！');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const filename = document.getElementById('image-output-filename').value || 'converted_images';

    // 获取当前图片顺序
    const imageOrder = Array.from(document.querySelectorAll('#image-preview .page-thumbnail'))
        .map(thumb => parseInt(thumb.dataset.index));

    // 按顺序添加图片
    for (let i = 0; i < imageOrder.length; i++) {
        if (i > 0) pdf.addPage();
        
        const file = imageFiles[imageOrder[i]];
        const reader = new FileReader();
        
        await new Promise((resolve) => {
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // 获取图片格式
                    const format = file.type.split('/')[1].toUpperCase();
                    
                    // 计算图片在PDF中的尺寸，保持宽高比
                    const imgProps = pdf.getImageProperties(img);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    // 如果图片高度超过PDF页面高度，则按高度缩放
                    let finalWidth = pdfWidth;
                    let finalHeight = pdfHeight;
                    if (pdfHeight > pdf.internal.pageSize.getHeight()) {
                        finalHeight = pdf.internal.pageSize.getHeight();
                        finalWidth = (imgProps.width * finalHeight) / imgProps.height;
                    }
                    
                    // 计算居中位置
                    const x = (pdf.internal.pageSize.getWidth() - finalWidth) / 2;
                    const y = (pdf.internal.pageSize.getHeight() - finalHeight) / 2;
                    
                    // 添加图片到PDF，支持多种格式
                    pdf.addImage(img, format, x, y, finalWidth, finalHeight);
                    resolve();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    pdf.save(`${filename}.pdf`);
} 
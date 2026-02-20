"use client";

import { useState } from "react";

export default function UploadDesign() {
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Handle file upload logic here
            setUploadedFile(file.name);
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
                Upload Your Document
            </label>
            <input
                type="file"
                id="design-upload"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
            />
            <label
                htmlFor="design-upload"
                className="inline-block px-6 py-3 bg-[#CFCFCF] hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer transition-colors"
            >
                {uploadedFile ? `Uploaded: ${uploadedFile}` : "Upload Design"}
            </label>
        </div>
    );
}

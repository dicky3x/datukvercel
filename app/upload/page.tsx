"use client";

import AuthGate from "@/components/AuthGate";
import DatasetUpload from "@/components/DatasetUpload";

export default function Page() {
  return (
    <AuthGate>
      {(auth) =>
        auth.role !== "super" ? (
          <div className="max-w-3xl mx-auto p-8">
            <p className="bg-red-50 text-red-700 rounded-md p-4">Fitur ini hanya bisa diakses oleh super user.</p>
          </div>
        ) : (
          <DatasetUpload />
        )
      }
    </AuthGate>
  );
}

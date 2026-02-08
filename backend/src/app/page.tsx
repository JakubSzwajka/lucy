export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="max-w-lg w-full px-6 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Lucy API</h1>
        <p className="text-gray-400 mb-8">
          AI-powered assistant backend with multi-agent support, tool integrations, and real-time streaming.
        </p>

        <div className="space-y-3">
          <a
            href="/api/health"
            className="block w-full rounded-lg border border-gray-700 px-4 py-3 text-sm hover:border-gray-500 hover:bg-gray-900 transition-colors"
          >
            <span className="font-medium text-gray-200">Health Check</span>
            <span className="block text-gray-500 text-xs mt-1">GET /api/health</span>
          </a>

          <a
            href="/api/openapi"
            className="block w-full rounded-lg border border-gray-700 px-4 py-3 text-sm hover:border-gray-500 hover:bg-gray-900 transition-colors"
          >
            <span className="font-medium text-gray-200">OpenAPI Specification</span>
            <span className="block text-gray-500 text-xs mt-1">GET /api/openapi</span>
          </a>
        </div>

        <p className="text-gray-600 text-xs mt-12">
          Lucy v0.1.0
        </p>
      </div>
    </div>
  );
}

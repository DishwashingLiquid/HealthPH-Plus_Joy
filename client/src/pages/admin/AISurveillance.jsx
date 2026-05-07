const AISurveillance = () => {
    return (
        <div className="flex flex-col gap-[20px]">
            {/* PAGE HEADER */}
            <div>
                <h1 className="text-[28px] font-semibold text-gray-800">
                    AI Surveillance
                </h1>

                <p className="text-gray-500 mt-[4px]">
                    Real-time disease surveillance, outbreak monitoring, and AI-driven public health analytics.
                </p>
            </div>

            {/* FILTER SECTION */}
            <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                <div className="flex flex-wrap gap-[12px]">
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Region Filter
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Disease Filter
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Time Range
                    </div>
                    <div className="bg-[#F5F5F5] px-[16px] py-[10px] rounded-[8px]">
                        Language
                    </div>
                </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-[20px]">
                {/* SUSPECTED CASES */}
                <div className="xl:col-span-1 bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
                    <div className="flex justify-between items-center h-full">
                        {/* LEFT */}
                        <div className="flex flex-col justify-center">
                            <p className="text-gray-500 text-sm mb-[8px]">Suspected Cases</p>
                            <h2 className="text-[32px] font-semibold text-gray-800 leading-none">1,120,540</h2>
                        </div>
                        {/* RIGHT */}
                        <div className="grid grid-cols-2 gap-x-[32px] gap-y-[8px]">
                            <div>
                                <p className="text-xs text-gray-500 uppercase">TB</p>
                                <p className="text-[12px] font-semibold text-gray-800">14020</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">COVID</p>
                                <p className="text-[12px] font-semibold text-gray-800">120</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Pneumonia</p>
                                <p className="text-[12px] font-semibold text-gray-800">310</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase">AURI</p>
                                <p className="text-[12px] font-semibold text-gray-800">58000</p>
                            </div>
                        </div>
                    </div>
                </div>
                {/* ACTIVE REGIONS */}
                <SummaryCard label="Active Regions" value="15" />
                {/* RESPIRATORY ALERTS */}
                <SummaryCard label="Respiratory Alerts" value="3" />
                {/* HIGH RISK AREAS */}
                <SummaryCard label="High Risk Areas" value="5" />
            </div>

            {/* MAIN CONTENT */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                {/* MAP SECTION */}
                <div className="xl:col-span-2 bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[520px]">
                    <h2 className="text-[20px] font-semibold text-gray-800 mb-[16px]">Real-time Outbreak Monitoring</h2>
                    <div className="w-full h-[450px] bg-[#F5F5F5] rounded-[12px] flex items-center justify-center text-gray-400">Map Visualization Placeholder</div>
                </div>
                {/* RIGHT PANELS */}
                <div className="flex flex-col gap-[20px]">
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">Environmental Data</h2>
                        <div className="flex flex-col gap-[12px]">
                            <MetricRow label="Air Quality Index" value="Moderate" />
                            <MetricRow label="Weather Pattern" value="Humid / Cloudy" />
                            <MetricRow label="Heat Index" value="38°C" />
                        </div>
                    </div>
                    <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px]">
                        <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">AI Insights</h2>
                        <div className="flex flex-col gap-[12px]">
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Increase flu-related mentions detected in NCR</div>
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Spike in respiratory symptom reports in Region IV-A</div>
                            <div className="bg-[#F5F5F5] rounded-[8px] p-[12px]">Misinformation alert volume increased by 12%</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* HEALTH MONITORING */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                <Panel title="Symptom Frequency" />
                <Panel title="Respiratory Monitoring" />
                <Panel title="Trend Forecasting" />
            </div>

            {/* LEGACY ANALYTICS INTEGRATION */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-[20px]">
                <Panel title="Top Words" />
                <Panel title="Word Cloud" />
                <Panel title="Suspected Conditions Percentage" />
            </div>
        </div>
    );
};

const SummaryCard = ({ label, value }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
            <p className="text-gray-500 text-sm">{label}</p>
            <h2 className="text-[32px] font-semibold text-gray-800 mt-[8px]">{value}</h2>
        </div>
    );
};

const MetricRow = ({ label, value }) => {
    return (
        <div className="flex justify-between items-center bg-[#F5F5F5] rounded-[8px] p-[12px]">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value}</span>
        </div>
    );
};

const Panel = ({ title }) => {
    return (
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[20px] min-h-[260px]">
            <h2 className="text-[18px] font-semibold text-gray-800 mb-[16px]">{title}</h2>
            <div className="w-full h-[180px] bg-[#F5F5F5] rounded-[12px] flex items-center justify-center text-gray-400">{title} Placeholder</div>
        </div>
    );
};

export default AISurveillance;
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const COUNTRIES = [
	"Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
	"Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
	"Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus","Czechia",
	"Denmark","Djibouti","Dominica","Dominican Republic",
	"Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
	"Fiji","Finland","France",
	"Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guyana",
	"Haiti","Honduras","Hungary",
	"Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
	"Jamaica","Japan","Jordan",
	"Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan",
	"Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg",
	"Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Moldova","Mongolia","Montenegro","Morocco","Mozambique","Myanmar",
	"Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway",
	"Oman",
	"Pakistan","Palau","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal",
	"Qatar",
	"Romania","Russia","Rwanda",
	"Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
	"Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu",
	"Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
	"Vanuatu","Venezuela","Vietnam",
	"Yemen",
	"Zambia","Zimbabwe"
]

function useCountryFilter(query: string) {
	return useMemo(() => {
		if (!query) return []
		const q = query.toLowerCase()
		return COUNTRIES.filter(c => c.toLowerCase().includes(q)).slice(0, 8)
	}, [query])
}

interface Step6AudienceSegmentationProps {
	onNext: () => void
	onBack: () => void
	onDataChange?: () => void
}

export function Step6AudienceSegmentation({ onNext, onBack, onDataChange }: Step6AudienceSegmentationProps) {
	const [respondents, setRespondents] = useState<number | ''>(() => { try { const v = localStorage.getItem('cs_step6'); if (v) { const o = JSON.parse(v); return typeof o.respondents === 'number' ? o.respondents : '' } } catch {}; return '' })
	const [countryQuery, setCountryQuery] = useState("")
	const [countries, setCountries] = useState<string[]>(() => { try { const v = localStorage.getItem('cs_step6'); if (v) { const o = JSON.parse(v); return Array.isArray(o.countries) ? o.countries : [] } } catch {}; return [] })
	const [genderMale, setGenderMale] = useState<number | ''>(() => { try { const v = localStorage.getItem('cs_step6'); if (v) { const o = JSON.parse(v); return typeof o.genderMale === 'number' ? o.genderMale : '' } } catch {}; return '' })
	const [genderFemale, setGenderFemale] = useState<number | ''>(() => { try { const v = localStorage.getItem('cs_step6'); if (v) { const o = JSON.parse(v); return typeof o.genderFemale === 'number' ? o.genderFemale : '' } } catch {}; return '' })
	const [ageSelections, setAgeSelections] = useState<Record<string, { checked: boolean; percent: string }>>(() => { try { const v = localStorage.getItem('cs_step6'); if (v) { const o = JSON.parse(v); if (o.ageSelections && typeof o.ageSelections === 'object') return o.ageSelections } } catch {}; return { "18 - 24": { checked: false, percent: "" }, "25 - 34": { checked: false, percent: "" }, "35 - 44": { checked: false, percent: "" }, "45 - 54": { checked: false, percent: "" }, "55 - 64": { checked: false, percent: "" }, "65+": { checked: false, percent: "" } } })

	const suggestions = useCountryFilter(countryQuery)

	const addCountry = (name: string) => {
		if (!countries.includes(name)) setCountries((prev) => [...prev, name])
		setCountryQuery("")
	}

	const removeCountry = (name: string) => setCountries((prev) => prev.filter((c) => c !== name))

	const canProceed = typeof respondents === 'number' && respondents > 0 && countries.length > 0

	useEffect(() => {
		if (typeof window === 'undefined') return
		localStorage.setItem('cs_step6', JSON.stringify({ respondents, countries, genderMale, genderFemale, ageSelections }))
		onDataChange?.()
	}, [respondents, countries, genderMale, genderFemale, ageSelections, onDataChange])

	return (
		<div>
			<div>
				<h3 className="text-lg font-semibold text-gray-800">Audience Segmentation</h3>
				<p className="text-sm text-gray-600">Configure the parameters that will be used to generate the RDE task matrix.</p>
			</div>

			<div className="space-y-6 mt-5">
				<div>
					<label className="block text-sm font-semibold text-gray-800 mb-2">Number of Respondents <span className="text-red-500">*</span></label>
					<Input type="number" value={respondents} onChange={(e) => setRespondents(e.target.value === '' ? '' : Number(e.target.value))} className="rounded-lg" />
				</div>

				<div>
					<label className="block text sm font-semibold text-gray-800 mb-2">Country Selection <span className="text-red-500">*</span></label>
					<div className="relative">
						<div className="flex flex-wrap gap-2 border rounded-lg p-2">
							{countries.map((c) => (
								<span key={c} className="px-2 py-1 bg-[rgba(38,116,186,0.1)] text-[rgba(38,116,186,1)] rounded-md text-xs flex items-center gap-1">
									{c}
									<button type="button" className="text-gray-500" onClick={() => removeCountry(c)}>×</button>
								</span>
							))}
							<input
								className="flex-1 min-w-[120px] outline-none px-2"
								placeholder="Type a country..."
								value={countryQuery}
								onChange={(e) => setCountryQuery(e.target.value)}
							/>
						</div>
						{suggestions.length > 0 && (
							<div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-sm max-h-56 overflow-auto">
								{suggestions.map((s) => (
									<button type="button" key={s} onClick={() => addCountry(s)} className="w-full text-left px-3 py-2 hover:bg-slate-50">
										{s}
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				<div>
					<div className="text-sm font-semibold text-gray-800 mb-2">Audience Distribution</div>
					<div className="flex items-center gap-2">
						<div className="px-4 py-2 rounded-md bg-slate-100 border text-sm">Male</div>
						<Input type="number" value={genderMale} onChange={(e) => setGenderMale(e.target.value === '' ? '' : Number(e.target.value))} className="w-20 text-center" />
						<div className="text-sm">%</div>
						<div className="px-4 py-2 rounded-md bg-slate-100 border text-sm ml-4">Female</div>
						<Input type="number" value={genderFemale} onChange={(e) => setGenderFemale(e.target.value === '' ? '' : Number(e.target.value))} className="w-20 text-center" />
						<div className="text-sm">%</div>
					</div>
				</div>

				<div>
					<div className="text-sm font-semibold text-gray-800 mb-2">Age Distribution</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{Object.entries(ageSelections).map(([label, v]) => (
							<div key={label} className="flex items-center gap-2 border rounded-md p-2">
								<input type="checkbox" checked={v.checked} onChange={(e) => setAgeSelections((prev) => ({ ...prev, [label]: { ...prev[label], checked: e.target.checked } }))} />
								<div className="flex-1 text-sm">{label}</div>
								<Input
									value={v.percent}
									onChange={(e) => setAgeSelections((prev) => ({ ...prev, [label]: { ...prev[label], percent: e.target.value } }))}
									className="w-16 text-center"
								/>
								<div className="text-sm">%</div>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-10">
				<Button variant="outline" className="rounded-full px-6 w-full sm:w-auto" onClick={onBack}>Back</Button>
				<Button className="rounded-full px-6 bg-[rgba(38,116,186,1)] hover:bg-[rgba(38,116,186,0.9)] w-full sm:w-auto" onClick={onNext} disabled={!canProceed}>Next</Button>
			</div>
		</div>
	)
}



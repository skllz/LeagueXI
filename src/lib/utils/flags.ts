// Maps football-data.org team names → ISO 3166-1 alpha-2 country codes
// Used to generate flag images from flagcdn.com
const ISO: Record<string, string> = {
  Afghanistan: "af", Albania: "al", Algeria: "dz", Angola: "ao",
  Argentina: "ar", Armenia: "am", Australia: "au", Austria: "at",
  Azerbaijan: "az", Bahrain: "bh", Belgium: "be", Bolivia: "bo",
  "Bosnia and Herzegovina": "ba", "Bosnia-Herzegovina": "ba",
  Brazil: "br", Bulgaria: "bg", "Burkina Faso": "bf",
  Cameroon: "cm", Canada: "ca", "Cape Verde": "cv",
  Chile: "cl", China: "cn", Colombia: "co", Congo: "cg",
  "Costa Rica": "cr", Croatia: "hr", Cuba: "cu", Curaçao: "cw",
  Czechia: "cz", "Czech Republic": "cz", Denmark: "dk",
  Ecuador: "ec", Egypt: "eg", England: "gb-eng",
  Estonia: "ee", Ethiopia: "et", Finland: "fi", France: "fr",
  Germany: "de", Ghana: "gh", Greece: "gr", Guatemala: "gt",
  Honduras: "hn", Hungary: "hu", Iceland: "is", Indonesia: "id",
  Iran: "ir", Iraq: "iq", Ireland: "ie", Israel: "il", Italy: "it",
  Jamaica: "jm", Japan: "jp", Jordan: "jo",
  Kenya: "ke", "Korea Republic": "kr", "South Korea": "kr",
  Kosovo: "xk", Kuwait: "kw", Libya: "ly", Mali: "ml",
  Mexico: "mx", Morocco: "ma", Mozambique: "mz",
  Netherlands: "nl", "New Zealand": "nz", Nigeria: "ng",
  "North Macedonia": "mk", Norway: "no", Oman: "om",
  Panama: "pa", Paraguay: "py", Peru: "pe", Poland: "pl",
  Portugal: "pt", Qatar: "qa", Romania: "ro",
  "Saudi Arabia": "sa", Scotland: "gb-sct", Senegal: "sn",
  Serbia: "rs", Slovakia: "sk", Slovenia: "si",
  "South Africa": "za", Spain: "es", Sudan: "sd",
  Sweden: "se", Switzerland: "ch",
  Syria: "sy", Tanzania: "tz",
  "Trinidad and Tobago": "tt", Tunisia: "tn",
  Türkiye: "tr", Turkey: "tr", Ukraine: "ua",
  UAE: "ae", "United Arab Emirates": "ae",
  "United States": "us", USA: "us",
  Uruguay: "uy", Venezuela: "ve", Wales: "gb-wls",
  Zambia: "zm", Zimbabwe: "zw",
  Guyana: "gy", Uzbekistan: "uz", Kyrgyzstan: "kg",
}

export function getFlagUrl(country: string): string | null {
  const code = ISO[country]
  if (!code) return null
  return `https://flagcdn.com/w80/${code}.png`
}

// Kept for any text contexts
export function getFlag(country: string): string {
  const code = ISO[country]
  if (!code) return "🏳"
  // Convert ISO code to emoji flag (only works for 2-letter codes)
  if (code.length === 2) {
    return code
      .toUpperCase()
      .split("")
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join("")
  }
  return "🏳"
}

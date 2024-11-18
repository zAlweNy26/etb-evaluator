import { ofetch } from "ofetch"
import { rarityMap, type Expansion, type Product, type Rarity } from "./types"
import pullRates from './pull_rates.json'
import prompts from "prompts"

const authFetch = ofetch.create({
    baseURL: "https://api.cardtrader.com/api/v2",
    headers: {
        "Authorization": `Bearer ${Bun.env.JWT_TOKEN}`
    },
    responseType: "json",
})

const availableExpansions = Object.keys(pullRates).map(exp => exp.toLowerCase())
const expansions = await authFetch<Expansion[]>('/expansions')
const filteredExpansions = expansions.filter(expansion => 
    expansion.game_id === 5 && // Pokémon
    availableExpansions.includes(expansion.code) // Only expansions we have pull rates for
)

const response = await prompts([
    {
        name: 'language',
        type: 'select',
        message: 'Choose a language:',
        choices: [
            { title: 'English', value: 'en' },
            { title: 'Italian', value: 'it' },
            { title: 'Spanish', value: 'es' },
            { title: 'French', value: 'fr' }
        ]
    }, {
        name: 'expansion',
        type: 'autocomplete',
        message: 'Pick an expansion:',
        choices: filteredExpansions.reverse().map(exp => ({ title: `${exp.name} (${exp.code.toUpperCase()})`, value: exp.code }))
    }
])

const specificExp = filteredExpansions.find(e => e.code === response.expansion)

if (!specificExp) {
    console.error('Invalid expansion')
    process.exit(1)
}

const specificPullRates: Record<string, number> = pullRates[response.expansion.toUpperCase() as keyof typeof pullRates].specific

const getPullRate = (rarity: Rarity) => {
    const rate = specificPullRates[rarityMap[rarity]]
    return (1 / rate) * 100
}

const res = await authFetch<Record<string, Product[]>>('/marketplace/products', { 
    params: { 
        expansion_id: specificExp.id,
        foil: false
    } 
})

// List all rarities present in the expansion
console.log(`\nRarities present in the expansion: `)
console.log([...new Set(
    Object.values(res).flat().map(p => p.properties_hash.pokemon_rarity)
)].filter(Boolean).join(', '))
console.log('')

const products = Object.values(res).map(p => {
    const res = p.filter(b =>
        b.properties_hash.condition === 'Near Mint' &&
        b.properties_hash.pokemon_language === response.language &&
        Object.keys(rarityMap).includes(b.properties_hash.pokemon_rarity)
    )
    return res[0]
}).filter(Boolean)

const orderedProducts = products.sort((a, b) => b.price.cents - a.price.cents)

// List the top 10 most expensive cards in the expansion
console.log(orderedProducts.slice(0, 10)
    .map(p => `${p.name_en} (${p.properties_hash.pokemon_rarity}) - ${p.price.formatted} | ${getPullRate(p.properties_hash.pokemon_rarity).toFixed(5)} %`)
    .join('\n'))

// Calculate the ETB evaluation based on the top 10 most expensive cards
const etbRate = orderedProducts.slice(0, 10).reduce((acc, c) => 
    acc + getPullRate(c.properties_hash.pokemon_rarity), 
    0
)
// TODO: Improve algorithm
console.log(`\n\nETB evaluation: ${((etbRate / 100) * 9).toFixed(5)} %`)

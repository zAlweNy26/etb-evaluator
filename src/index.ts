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
        choices: Object.keys(pullRates).map(exp => ({ title: exp, value: exp }))
    }
])

const expansions = await authFetch<Expansion[]>('/expansions')
const filteredExpansions = expansions.filter(expansion => expansion.game_id === 5) // Pokémon
const specificExp = filteredExpansions.find(e => e.code === response.expansion.toLowerCase())

if (!specificExp) {
    console.error('Invalid expansion')
    process.exit(1)
}

const specificPullRates: Record<string, number> = pullRates[response.expansion as keyof typeof pullRates].specific

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

const products = Object.values(res).map(p => {
    const res = p.filter(b =>
        b.properties_hash.condition === 'Near Mint' &&
        b.properties_hash.pokemon_language === response.language
    )
    return res[0]
}).filter(Boolean)

const orderedProducts = products.sort((a, b) => b.price.cents - a.price.cents)
console.log(orderedProducts.slice(0, 10)
    .map(p => `${p.name_en} - ${p.price.formatted} | ${getPullRate(p.properties_hash.pokemon_rarity).toFixed(5)} %`)
    .join('\n'))

const etbRate = orderedProducts.slice(0, 10)
    .reduce((acc, c) => acc + getPullRate(c.properties_hash.pokemon_rarity), 0)
console.log(`\n\nETB evaluation: ${((etbRate / 100) * 9).toFixed(5)} %`)
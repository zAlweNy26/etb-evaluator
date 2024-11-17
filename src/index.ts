import { ofetch } from "ofetch"
import { rarityMap, type Expansion, type Product, type Rarity } from "./types"
import pullRates from './pull_rates.json'
//import prompts from "prompts"

const language = 'it' // Italian
const exp = "SSP" // Surging Sparks

const authFetch = ofetch.create({
    baseURL: "https://api.cardtrader.com/api/v2",
    headers: {
        "Authorization": `Bearer ${Bun.env.JWT_TOKEN}`,
        language,
    },
    responseType: "json",
})

const getPullRate = (rarity: Rarity) => {
    const rate = specificPullRates[rarityMap[rarity]]
    return (1 / rate) * 100
}

const expansions = await authFetch<Expansion[]>('/expansions')
const filteredExpansions = expansions.filter(expansion => expansion.game_id === 5) // Pokémon
const specificExp = filteredExpansions.filter(e => e.code === exp.toLowerCase())
const specificPullRates: Record<string, number> = pullRates[exp].specific
//const orderedExpansions = filteredExpansions.sort((a, b) => b.id - a.id)
//console.log(orderedExpansions.slice(20, 40).map(e => `${e.name} (${e.code.toUpperCase()}) - ${e.id}`).join('\n'))
for (const exp of specificExp) {
    const res = await authFetch<Record<string, Product[]>>('/marketplace/products', { 
        params: { 
            expansion_id: exp.id,
            foil: false
        } 
    })
    const products = Object.values(res).map(p => {
        const res = p.filter(b =>
            b.properties_hash.condition === 'Near Mint' &&
            b.properties_hash.pokemon_language === language
        )
        return res[0]
    }).filter(Boolean)
    const orderedProducts = products.sort((a, b) => b.price.cents - a.price.cents)
    //console.log([...new Set(orderedProducts.map(p => p.properties_hash.pokemon_rarity))])
    //console.dir(orderedProducts.slice(0, 10).map(p => ({ name: p.name_en, ...p.properties_hash})))
    console.log(orderedProducts.slice(0, 10)
        .map(p => `${p.name_en} - ${p.price.formatted} | ${getPullRate(p.properties_hash.pokemon_rarity).toFixed(3)} %`)
        .join('\n'))

    const etbRate = orderedProducts.slice(0, 10)
        .reduce((acc, c) => acc + getPullRate(c.properties_hash.pokemon_rarity), 0)
    console.log(`\n\nETB evaluation: ${((etbRate / 100) * 9).toFixed(3)} %`)
}

/*const blueprints = await authFetch<Blueprint[]>('/blueprints/export', { params: { expansion_id: 3878 } })
console.log(blueprints.map(b => b.name).join('\n'))

// Object containing the ID of the blueprint (as key) and an array with the cheapest 25 products (as value)
const marketProducts = await authFetch<Record<string, Product[]>>('/marketplace/products', { 
    params: { 
        //expansion_id: 3878,
        blueprint_id: 306350,
        foil: false
    } 
})
const flattenedMarketProducts = Object.values(marketProducts).flat()
console.log(flattenedMarketProducts.map(p => p.price.formatted).join('\n'))*/

/*
const res = await authFetch<{ array: Game[] }>('/games')
const games = res.array

const response = await prompts([
    {
        name: 'game',
        type: 'select',
        message: 'Choose a game:',
        choices: games.map(g => ({
            title: g.display_name,
            value: g.id
        }))
    }, {
        name: 'expansion',
        type: 'autocomplete',
        message: 'Pick an expansion:',
        async suggest() {
            const expansions = await authFetch<Expansion[]>('/expansions')
            const filteredExpansions = expansions.filter(expansion => expansion.game_id === 5)
            return filteredExpansions.map(e => ({ title: e.name, value: e.id }))
        },
        choices: [{ title: 'test', value: undefined }]
    }
])

console.log(response)*/
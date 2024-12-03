import { ofetch } from "ofetch"
import { rarityMap, type Expansion, type Product, type Rarity } from "./types"
import pullRates from './pull_rates.json'
import prompts from "prompts"
//import Turbit from 'turbit'
import { BaseN } from 'js-combinatorics'
import { SingleBar, Presets } from 'cli-progress'

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
            { title: 'Italian', value: 'it' },
            { title: 'English', value: 'en' },
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

const anyPullRates: Record<string, number> = pullRates[response.expansion.toUpperCase() as keyof typeof pullRates].any
const specificPullRates: Record<string, number> = pullRates[response.expansion.toUpperCase() as keyof typeof pullRates].specific

const getPullRate = (rarity: string) => {
    const rate = specificPullRates[rarityMap[rarity as Rarity]] ?? 1
    return { perc: (1 / rate) * 100, rate }
}

const res = await authFetch<Record<string, Product[]>>('/marketplace/products', { 
    params: { 
        expansion_id: specificExp.id,
        foil: false
    } 
})

// List all rarities present in the expansion
const availableRarities = [...new Set(
    Object.values(res).flat().map(p => p.properties_hash.pokemon_rarity)
)].filter(Boolean)
console.log(`\nRarities present in the expansion: `)
console.log(availableRarities.join(', '))
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
    .map(p => {
        const { perc, rate } = getPullRate(p.properties_hash.pokemon_rarity)
        return `${p.name_en} (${p.properties_hash.pokemon_rarity}) - ${p.price.formatted} | ${perc.toFixed(5)} % (${rate})`
    })
    .join('\n'))

console.log(`\nTotal products: ${products.length}`)

const totPacks = 3 // WARNING: DON'T GO FURTHER THAN 4 PACKS OR YOUR PC WILL DIE

console.time('Combinations')

const rareCards = products.filter(p => p.properties_hash.pokemon_rarity === 'Rare').length;
//console.log(`Rare cards: ${rareCards}`)

const combos = new BaseN(products.map(p => {
    let rate = (1 / anyPullRates[rarityMap[p.properties_hash.pokemon_rarity as Rarity]]) / products.filter(s => s.properties_hash.pokemon_rarity === p.properties_hash.pokemon_rarity).length
    //let rate = 1 / specificPullRates[rarityMap[p.properties_hash.pokemon_rarity as Rarity]]
    if (p.properties_hash.pokemon_rarity === 'Rare') {
        const allRates = Object.values(anyPullRates).reduce((acc, r) => acc + (1 / r), 0)
        rate = (1 - allRates) / rareCards
    }
    //console.log(rate)
    return { 
        price: p.price.cents / 100, 
        rarity: rate
    }
}), totPacks)

//console.dir(combos)

// Initialize the progress bar
const progressBar = new SingleBar(
    {
        format: 'Processing Combinations | {bar} | {percentage}% || {value}/{total} combos',
    },
    Presets.shades_classic
);

progressBar.start(Number(combos.length), 0);

const etbPrice = 5 * totPacks
let totWorth = 0
let processed = 0;

for (const combo of combos) {
    const worth = combo.reduce((acc, c) => acc + c.price, 0)
    const rate = combo.reduce((acc, c) => acc * c.rarity, 1)
    //console.log(`Worth: ${worth.toFixed(2)} | Rate: ${rate}`)
    if (worth >= etbPrice) totWorth += rate

    // Update the progress bar
    processed += 1;
    progressBar.update(processed);
}

// Stop the progress bar
progressBar.stop();

console.timeEnd('Combinations')
const totCombos = Number(combos.length)
console.log(`Total combinations: ${totCombos}`)

// TODO: Check if the algorithm is correct
//console.log(`\nWorth: ${totWorth} / ${totCombos} (${(totWorth * 100).toFixed(5)} %)`)
console.log(`\nProbability of pay off: ${(totWorth * 100).toFixed(5)} %`)

/*
const turbit = Turbit()
const combos = await turbit.run(combination, {
    type: 'extended',
    args: [3],
    data: [3]
})

console.dir(combos)
*/

process.exit(0)

import { ofetch } from 'ofetch'
import { rarityMap, type Expansion, type Product, type Rarity } from './types'
import pullRates from './pull_rates.json'
import prompts from 'prompts'
import chalk from 'chalk'
import os from 'os'
import { BaseN } from 'js-combinatorics'

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
    }, {
        name: 'numPacks',
        type: 'number',
        message: 'How many packs are you going to open? (DON\'T GO FURTHER THAN 4 PACKS OR YOUR PC WILL DIE)',
        initial: 3,
        min: 1,
        max: 9,
    }, {
        name: 'price',
        type: 'number',
        message: 'How much would it cost?',
        initial: 15,
        min: 0,
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
console.log(chalk.cyan(`\nRarities present in the expansion: `))
console.log(availableRarities.join(', '))

console.log(chalk.cyan('\nTen most expensive cards in the expansion:'))
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
        return `${p.name_en} (${p.properties_hash.pokemon_rarity}) - ${p.price.formatted} | ${perc.toFixed(5)} % (1/${rate})`
    })
    .join('\n'))

const rareCards = products.filter(p => p.properties_hash.pokemon_rarity === 'Rare').length

const maxProcess = os.cpus().length

console.log(`Number of CPU cores: ${maxProcess}`)

function baseWorker(combos: any[], price: number) {
    return new Promise<number>((resolve, reject) => {
        const worker = new Worker("./src/worker.ts")

        worker.onmessage = (event) => {
            resolve(event.data)
            worker.terminate()
        }

        worker.onerror = (err) => {
            reject(err)
            worker.terminate()
        }

        worker.postMessage({ combos, price })
    })
}

const len = products.length
const timeStart = Date.now()
const chunkSize = Math.ceil(len / maxProcess)
const promises = []
const combos = new BaseN(products.map(p => {
    let rate = (1 / anyPullRates[rarityMap[p.properties_hash.pokemon_rarity as Rarity]]) / products.filter(s => s.properties_hash.pokemon_rarity === p.properties_hash.pokemon_rarity).length
    if (p.properties_hash.pokemon_rarity === 'Rare') {
        const allRates = Object.values(anyPullRates).reduce((acc, r) => acc + (1 / r), 0)
        rate = (1 - allRates) / rareCards
    }
    return {
        price: p.price.cents / 100,
        rarity: rate
    }
}), response.numPacks)

for (let i = 0; i < maxProcess; i++) {
    const start = i * chunkSize + 1
    const end = Math.min((i + 1) * chunkSize, len)
    promises.push(baseWorker(combos.toArray().slice(start, end), response.price))
}

const results = await Promise.all(promises)
const final = results.reduce((acc, val) => acc + val, 0)
const timeEnd = Date.now()

console.log('Final result:', final)
console.log('Time taken:', timeEnd - timeStart, 'ms')

process.exit(0)
export interface Game {
    id: number
    name: string
    display_name: string
}

export interface Expansion {
    id: number
    game_id: number
    code: string
    name: string
}

export interface Blueprint {
    id: number
    name: string
    version: string | null
    game_id: number
    category_id: number
    expansion_id: number
    image_url: string
    card_market_ids: number[] | null
    editable_properties: {
        name: string
        type: string
        default_value: any
        possible_values: any[]
    }[]
}

export interface Product {
    id: number
    blueprint_id: number
    name_en: string
    quantity: number
    price: {
        cents: number
        currency: string
        currency_symbol: string
        formatted: string
    }
    description: string | null
    properties_hash: PokemonProperties
    expansion: {
        id: number
        code: string
        name_en: string
    }
    user: {
        id: number
        username: string
        country_code: string
        user_type: string
    }
    graded: boolean | null
    on_vacation: boolean
    bundle_size: number
}

export const rarityMap = {
    "Special Illustration Rare": "SIR",
    "Illustration Rare": "IR",
    "Rare ACE": "ASR",
    "Ultra Rare": "UR",
    "Hyper Rare": "HR",
    "Secret Rare": "HR", // Only on Scarlet & Violet expansions
    "Double Rare": "DR",
    "Shiny Ultra Rare": "SUR",
    "Shiny Holo Rare": "SR",
    "Common": "C",
    "Uncommon": "U",
    "Rare": "R",
} as const

export type Rarity = keyof typeof rarityMap

export interface PokemonProperties {
    pokemon_attack: string
    condition: "Mint" | "Near Mint" | "Excellent" | "Good" | "Light Played" | "Played" | "Poor"
    pokemon_reverse: boolean
    pokemon_stage: string
    tournament_legal: boolean
    collector_number: string
    pokemon_language: string
    pokemon_type: string
    signed: boolean
    pokemon_rarity: string
    first_edition: boolean
    altered: boolean
}
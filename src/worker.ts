declare var self: Worker

self.onmessage = (event: MessageEvent) => {
    const combos: Record<string, any>[][] = event.data.combos
    const price = event.data.price
    let totWorth = 0
    for (const combo of combos) {
        const worth = combo.reduce((acc, c) => acc + c.price, 0)
        const rate = combo.reduce((acc, c) => acc * c.rarity, 1)
        if (worth >= price) totWorth += rate
    }
    postMessage(totWorth)
}
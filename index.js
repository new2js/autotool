const path = require('path');
const fs = require('fs');
const PLANTS = 0,
    STONES = 1,
    ENERGY = 2,
    ALL = [PLANTS, STONES, ENERGY],
    NICENAME = ['Sickle', 'Pi\u200bckaxe', 'Extractor'], // zero-width space character \u200b used to prevent censor of "Picka"
    NAME = ['sickle', 'pick', 'extractor'],
    NODES = {
        1: ['harmony hrass', 'harmony', 'grass'],
        2: ['wild cobseed', 'cobseed', 'corn'],
        3: ['wild veridia', 'veridia', 'carrot'],
        4: ['orange mushroom', 'mushroom'],
        5: ['moongourd'],
        6: ['apple tree', 'apple'],
        101: ['plain stone', 'stone'],
        102: ['cobala ore', 'cobala', 'coba'],
        103: ['shadmetal ore', 'shadmetal', 'shad'],
        104: ['xermetal ore', 'xermetal', 'xer'],
        105: ['normetal ore', 'normetal', 'nor'],
        106: ['galborne ore', 'galborne', 'gal'],
        201: ['achromic essence', 'achromic'],
        202: ['crimson essence', 'crimson'],
        203: ['earth essence', 'earth'],
        204: ['azure essence', 'azure'],
        205: ['opal essence', 'opal'],
        206: ['obsidian essence', 'obsidian']
    }

module.exports = function autotool(mod) {
    const command = mod.command || mod.require.command

    let config
    try {
        config = require('./config.json')
    } catch (error) {
        config = {
            hide: false,
            helper: false,
            enabled: true
        }
    }

    let collections = [],
        other = [],
        currentLocation,
        mountFlag = false,
        inventory,
        inventoryCache,
        currentTools = [],
        active,
        helperIdStart = 1111111111,
        helperIdEnd = helperIdStart

    command.add('autotool', (...args) => {
        if (args[0] && args[0].length > 0) args[0] = args[0].toLowerCase()
        switch (args[0]) {
            case 'hide':
            case 'hideother':
            case 'unclutter':
            case 'showall':
            case 'show':
                if (config.hide === undefined) config.hide = false
                config.hide = !config.hide
                command.message(`Quest and non-gathering collection nodes ${config.hide ? 'hidden' : 'spawned'}`)
                for (let coll in other) {
                    if (!config.hide) {
                        mod.send('S_SPAWN_COLLECTION', 4, other[coll])
                    } else {
                        mod.send('S_DESPAWN_COLLECTION', 2, { gameId: other[coll].gameId });
                    }
                }
                break
            case 'helper':
                if (config.helper === undefined) config.helper = true
                if (args[1] && args[1].length > 0) args[1] = args[1].toLowerCase()
                switch (args[1]) {
                    case 'reset':
                        config.helperWhitelist = []
                        command.message('Helper whitelist cleared, showing beam on all nodes again')
                        break
                    case 'list':
                    case 'l':
                        let list = ''
                        for (let value of config.helperWhitelist) {
                            list += NODES[value][0].split(' ').map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') + ', '
                        }
                        list.slice(0, -2)
                        command.message('Helper whitelist: ' + list)
                        break
                    case '':
                    case undefined:
                        config.helper = !config.helper
                        command.message(`Gathering node finder helper beams ${config.helper ? 'en' : 'dis'}abled`)
                        break
                    default:
                        args.shift()
                        args = args.join(' ')
                        args.toLowerCase()
                        let found = 0
                        for (let n in NODES) {
                            if (NODES[n].includes(args)) {
                                if (config.helperWhitelist.includes(Number(n))) {
                                    config.helperWhitelist.splice(config.helperWhitelist.indexOf(n))
                                    found = 2
                                } else {
                                    config.helperWhitelist.push(Number(n))
                                    found = 1
                                }
                                break
                            }
                        }
                        if (found == 1) {
                            command.message(`Added ${args} to helper beam whitelist`)
                        } else if (found == 2) {
                            command.message(`Removed ${args} from helper beam whitelist`)
                        } else {
                            command.message('Valid values:')
                            for (let arr of Object.values(NODES)) {
                                command.message(arr.join(', '))
                            }
                        }
                        break
                }
                refreshHelper()
                break
            case 'info':
                let template = '<font color="#FDD017"><ChatLinkAction param="1#####%id@%dbid@%name">&lt;CLICK ME&gt;</ChatLinkAction></chat>'
                let link = template.replace(/%name/, mod.game.me.name)
                command.message('Your currently configured items:')
                for (let type of ALL) {
                    let str = ''
                    if (!currentTools[type]) {
                        str += `<font color="#FF0000">not found in inventory</font>`
                    } else {
                        str += link.replace(/%id/, currentTools[type].id).replace(/%dbid/, currentTools[type].dbid)
                    }
                    command.message(`${NICENAME[type]}: ${str}`)

                }
                command.message(`Gathering node finder helper beams: ${config.helper ? 'enabled' : 'disabled'}`)
                command.message(`Quest and non-gathering collection nodes: ${config.hide ? 'hidden' : 'spawned'}`)
                break
            default:
                if (config.enabled === undefined) config.enabled = true
                config.enabled = !config.enabled
                command.message(`Module: ${config.enabled ? 'enabled' : 'disabled'}`)
                if (!config.enabled) {
                    for (let coll in collections) {
                        if (collections[coll].helperId) mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[coll].helperId });
                    }
                    for (let coll in other) {
                        mod.send('S_SPAWN_COLLECTION', 4, other[coll])
                    }
                    reset()
                }
                break
        }
        saveConfig()
    })

    mod.hook('S_SPAWN_COLLECTION', 4, event => {
        if (!config.enabled) return
        let type = Math.floor(event.id / 100)
        if (!ALL.includes(type)) {
            other[Number(event.gameId)] = event
            if (config.hide) return false
            return
        }
        collections[Number(event.gameId)] = event
        if (config.helper && (config.helperWhitelist.length == 0 || config.helperWhitelist.includes(event.id))) {
            let helperId = helperIdEnd++
            collections[Number(event.gameId)].helperId = helperId            
            event.loc.z -= 1000
            mod.toClient('S_SPAWN_DROPITEM', 7, {
                gameId: helperId,
                loc: event.loc,
                item: 98260,
                amount: 1,
                expiry: 30000,
                explode: false,
                masterwork: false,
                enchant: 0,
                source: BigInt(0),
                debug: false,
                owners: [{ id: 0 }],
                ownerName: ''
            });
        }

    })
    mod.hook('S_DESPAWN_COLLECTION', 2, event => {
        if (!config.enabled) return
        if (other[event.gameId]) {
            delete other[event.gameId]
            return
        }
        let item = collections[Number(event.gameId)]
        if (!item) return
        if (item.helperId) {
            mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: item.helperId });
        }
        delete collections[event.gameId];
    })

    mod.hook('S_ITEMLIST', 3, event => {
        if (!config.enabled) return
        inventory = inventory ? inventory.concat(event.items) : event.items

        if (!event.more) {
            for (let type of ALL) {
                let typeItemsTier = inventory.map(item => {
                    if (Math.floor((item.id - 206600) / 10) == type) {
                        return (item.id - 206600) % 10
                    }
                }).filter(item => item != undefined)
                let bestTier = Math.max(...typeItemsTier)
                if (bestTier != -Infinity) {
                    let bestId = 206600 + type * 10 + bestTier
                    currentTools[type] = inventory.find(item => item.id == bestId)
                } else {
                    currentTools[type] = undefined
                }
            }
            inventoryCache = inventory
            inventory = null
        }
    })

    mod.hook('S_SYSTEM_MESSAGE', 1, (event) => {
        if (!config.enabled) return
        let data = mod.parseSystemMessage(event.message);
        switch (data.id) {
            case 'SMT_ITEM_USED_ACTIVE':
                active = Math.floor((Number(data.tokens.ItemName.match(/\d+/)) - 206600) / 10)
                break
            case 'SMT_ITEM_USED_DEACTIVE':
                if (Math.floor((Number(data.tokens.ItemName.match(/\d+/)) - 206600) / 10) == active) active = undefined
                break
        }
    });

    mod.hook('C_PLAYER_LOCATION', 5, updateLocation);
    mod.hook('S_SPAWN_ME', 3, updateLocation)
    mod.hook('C_PLAYER_FLYING_LOCATION', 4, updateLocation)

    function refreshHelper() {
        for (let coll in collections) {
            if (collections[coll].helperId) mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[coll].helperId });
            collections[coll].helperId = undefined
        }
        helperIdEnd = helperIdStart
        for (let coll in collections) {
            if (config.helper && config.helperWhitelist.includes(collections[coll].id)) {
                let helperId = helperIdEnd++
                collections[coll].helperId = helperId
                let loc = collections[coll].loc
                loc.z -= 1000
                mod.toClient('S_SPAWN_DROPITEM', 7, {
                    gameId: helperId,
                    loc: loc,
                    item: 98260,
                    amount: 1,
                    expiry: 30000,
                    explode: false,
                    masterwork: false,
                    enchant: 0,
                    source: BigInt(0),
                    debug: false,
                    owners: [{ id: 0 }],
                    ownerName: ''
                });
            }
        }
    }

    function updateLocation(event) {
        if (!config.enabled) return
        currentLocation = {
            loc: event.loc,
            dest: event.dest,
            w: event.w || (currentLocation ? currentLocation.w : 0)
        }
        calcTools()
    }

    function calcTools() {
        if (!currentLocation || Object.keys(collections).length == 0 || !inventoryCache) return
        if (mod.game.me.onPegasus || mod.game.me.inBattleground || !mod.game.me.alive) return
        if (mod.game.me.mounted) {
            if (mountFlag) return
            mountFlag = true
            mod.game.me.on('dismount', calcTools)
            return
        }
        if (mountFlag) {
            mountFlag = false
            mod.game.me.off('dismount', calcTools)
        }

        let nearest = Infinity,
            nearestGameId

        for (let coll in collections) {
            let dist = dist2Dsq(collections[coll].loc, currentLocation.loc)
            if (dist < nearest) {
                nearest = dist
                nearestGameId = coll
            }
        }
        if (nearestGameId) {
            let node = collections[nearestGameId]
            let type = Math.floor(node.id / 100)
            let tool = currentTools[type]
            if (!tool || type == active) return
            active = type
            console.log(`Activating ${NAME[type]}`)
            useItem(tool.id, tool.dbid)
        }
    }

    function dist2Dsq(loc1, loc2) {
        return Math.pow(loc2.x - loc1.x, 2) + Math.pow(loc2.y - loc1.y, 2);
    }

    function useItem(id, dbid) {
        mod.send('C_USE_ITEM', 3, {
            gameId: mod.game.me.gameId,
            id: id,
            dbid: dbid,
            target: 0,
            amount: 1,
            dest: { x: 0, y: 0, z: 0 },
            loc: currentLocation.dest || currentLocation.loc,
            w: currentLocation.w,
            unk1: 0,
            unk2: 0,
            unk3: 0,
            unk4: true
        })
    }

    mod.game.on('enter_loading_screen', reset)

    function reset() {
        currentLocation = null
        mountFlag = false
        mod.game.me.off('dismount', calcTools)
        active = undefined
    }

    function saveConfig() {
        fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, '\t'), err => { });
    }

    this.destructor = () => {
        for (let coll in collections) {
            if (collections[coll].helperId) mod.toClient('S_DESPAWN_DROPITEM', 4, { gameId: collections[coll].helperId });
        }
        command.remove('autotool')
        if (mod.game) mod.game.off('enter_loading_screen', reset)
        if (mod.game.me) mod.game.me.off('dismount', calcTools)
    }
}
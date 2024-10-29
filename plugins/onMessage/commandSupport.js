import fs from 'fs';
import path from 'path';
import axios from 'axios'; // Assurez-vous que cette dépendance est installée

const commandRootDir = path.resolve('./plugins/commands');

const fetchCommandFiles = () => {
    const commandFiles = [];

    const categories = fs.readdirSync(commandRootDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const category of categories) {
        const commandDir = path.join(commandRootDir, category);
        const commands = fs.readdirSync(commandDir)
            .filter(file => file.endsWith('.js'))
            .map(file => path.join(commandDir, file));

        if (commands.length > 0) {
            commandFiles.push({
                category,
                commands
            });
        }
    }

    return commandFiles;
};

const loadCommand = async (filePath) => {
    try {
        const { default: commandModule } = await import(filePath);
        if (commandModule?.config?.name) {
            return { commandModule, name: commandModule.config.name };
        } else {
            console.warn(`Command config.name not found in ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`Failed to load command from ${filePath}:`, error);
        return null;
    }
};

async function fetchApiResponse(messageBody) {
    const prompt = messageBody; // Utilisez le corps du message comme prompt
    const customId = 'yourCustomId'; // Remplacez par votre identifiant personnalisé si nécessaire

    try {
        const response = await axios.post('https://gemini-sary-prompt-espa-vercel-api.vercel.app/api/gemini', {
            prompt,
            customId
        });
        return response.data; // Ajustez si nécessaire selon la structure de votre réponse API
    } catch (error) {
        console.error('API call failed:', error);
        throw new Error("⚠️ Failed to fetch data from API");
    }
}

async function onCall({ message }) {
    const input = message.body.trim().toLowerCase();

    // Vérifiez si le message est une commande
    const commandFiles = fetchCommandFiles();
    for (const { commands } of commandFiles) {
        for (const filePath of commands) {
            const commandData = await loadCommand(filePath);
            if (commandData && input.startsWith(commandData.name)) {
                const { commandModule, name } = commandData;

                if (commandModule?.config && commandModule.onCall) {
                    const args = input.slice(name.length).trim().split(" ");
                    const prefix = message.thread?.data?.prefix || global.config.PREFIX;

                    await commandModule.onCall({ 
                        message, 
                        args, 
                        data: { thread: { data: { prefix } } }, 
                        userPermissions: message.senderID, 
                        prefix 
                    });
                }
                return; // Fin de la fonction si c'est une commande
            }
        }
    }

    // Si ce n'est pas une commande, appelez l'API pour obtenir une réponse
    try {
        const apiResponse = await fetchApiResponse(message.body);
        await message.reply(apiResponse); // Répondre avec la réponse de l'API
    } catch (error) {
        console.error(error);
        await message.reply("⚠️ Une erreur est survenue lors de la récupération des données.");
    }
}

export default {
    onCall
};

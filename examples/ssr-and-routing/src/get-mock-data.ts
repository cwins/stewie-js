import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type AppData } from './app';

const rootDir = path.join(import.meta.dirname, '.temp-mocks');
const mockFile = path.join(rootDir, 'data.json');

const projectTaskCounts = [4, 40, 400];

export const getMockData = async (): Promise<AppData | undefined> => {
    if (existsSync(mockFile)) {
        return JSON.parse(readFileSync(mockFile, { encoding: 'utf-8' }));
    }

    return;
}

export const createMockData = async (overwrite: boolean = false) => {
    if (!existsSync(rootDir)) {
        mkdirSync(rootDir);
    }

    if (existsSync(mockFile) && overwrite === false) {
        return;
    }

    const capitalizeFirstLetter = (str: string) => {
        if (str.length === 0) {
            return str;
        }
        return str.charAt(0).toUpperCase() + str.slice(1);
    }   

    try {
        const { faker } = await import('@faker-js/faker/locale/en_US');

        const data: AppData = {
            projects: projectTaskCounts.map((taskCount, index) => {
                const projectId = `p${index + 1}`;
 
                return {
                    id: projectId,
                    name: capitalizeFirstLetter(`${faker.word.adjective()} ${faker.word.noun()}`),
                    taskCount
                }
            }),
            tasks: projectTaskCounts.reduce((tasks, taskCount, index) => {
                const projectId = `p${index + 1}`;
                
                for (let i = 0; i <= taskCount; i++) {
                    const taskId = `t${i + 1}`;

                    tasks.push({
                        projectId,
                        id: taskId,
                        title: capitalizeFirstLetter(faker.word.words({ count: { min: 5, max: 10 } })),
                        description: capitalizeFirstLetter(faker.word.words({ count: { min: 10, max: 30 } })),
                        isCompleted: faker.datatype.boolean(),
                        dueDate: faker.date.soon().toISOString().split('T')[0]
                    })
                }

                return tasks;
            }, [] as AppData['tasks'])
        };

        writeFileSync(mockFile, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
    }
    catch (error) {
        console.log('Something went wrong during creation of mock data file');
        console.error(error);
    }
}

console.log(process.argv);

await createMockData(process.argv[2] === '--overwrite');

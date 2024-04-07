import { beforeEach, describe, expect, it } from "@jest/globals";
import * as ModelEvent from "@node-elion/syncron";
import {
    BasicDbDriver,
    getDbDriver,
    ModelEventConstructorAnalyzer,
    ModelEventSubscriberAnalyzer,
    SORT,
} from "./utils";

describe("ModelEventSubscriber", () => {
    const modelName: string = "test";
    beforeEach(() => {});
    const simpleWait = (time: number) =>
        new Promise((resolve) => {
            setTimeout(resolve, time);
        });
    const idExtractor = (items: any[]) => items.map((item) => item.id);

    const StrictSettings: Partial<ModelEvent.SubscribeConfig> = {
        batchSize: ModelEvent.ModelSubscribeEventBatchSize.auto,

        optimization: {
            publisherModelEventOptimization: false,
            subscriberPostModelEventOptimization: false,
        },
        firstContentSend: false,
        queWaitTime: ModelEvent.ModelSubscribeEventQueWaitTime.default,

        keepAlive: {
            onKeepAlive: () => Promise.resolve(true),
        },
    };

    const FCRStrictSettings: Partial<ModelEvent.SubscribeConfig> = {
        batchSize: ModelEvent.ModelSubscribeEventBatchSize.auto,
        optimization: {
            publisherModelEventOptimization: false,
            subscriberPostModelEventOptimization: false,
        },
        queWaitTime: ModelEvent.ModelSubscribeEventQueWaitTime.default,

        firstContentSend: {
            size: ModelEvent.ModelSubscriberEventFirstContentSendSize.auto,
        },

        keepAlive: {
            onKeepAlive: () => Promise.resolve(true),
        },
    };

    function getBasicInternals(settings: Partial<ModelEvent.SubscribeConfig>): {
        db: BasicDbDriver;
        sortType: SORT;
        modelEventConstructor: ModelEvent.ModelEventConstructor;
        constructorAnalyzer: ModelEventConstructorAnalyzer;
        subscriberAnalyzer: ModelEventSubscriberAnalyzer;
        subscriberSettings: ModelEvent.SubscribeConfig;
    } {
        const db = getDbDriver();

        const subscriberAnalyzer = new ModelEventSubscriberAnalyzer(
            modelName,
            db,
        );
        const constructorAnalyzer = new ModelEventConstructorAnalyzer(true);
        const modelEventConstructor = new ModelEvent.ModelEventConstructor({
            onUpdate: constructorAnalyzer.onUpdate.bind(constructorAnalyzer),
            onModelUpdate:
                constructorAnalyzer.onModelUpdate.bind(constructorAnalyzer),
            onMetaUpdate:
                constructorAnalyzer.onMetaUpdate.bind(constructorAnalyzer),
            onSystemEvent:
                constructorAnalyzer.onSystemEvent.bind(constructorAnalyzer),
        });

        const subscriberSettings: ModelEvent.SubscribeConfig = {
            ...settings,
            keepAlive: {
                ...settings.keepAlive,
            },

            getAll: () => subscriberAnalyzer.getAll({}),
            getAllIds: () => subscriberAnalyzer.getAllIds({}),

            trackModelName: modelName,
            idParamName: "id",

            getById: subscriberAnalyzer.getById.bind(subscriberAnalyzer),
            sanitizeModel:
                subscriberAnalyzer.sanitizeModel.bind(subscriberAnalyzer),
            track: subscriberAnalyzer.track.bind(subscriberAnalyzer),
            removeTrack:
                subscriberAnalyzer.removeTrack.bind(subscriberAnalyzer),
            onModelEvent: (event) => {
                modelEventConstructor.onEvent(event);
            },
        };

        return {
            db,
            sortType: SORT.ASC,
            modelEventConstructor,
            constructorAnalyzer,
            subscriberAnalyzer,
            subscriberSettings,
        };
    }

    function basicTests(settings: {
        name: string;
        config: Partial<ModelEvent.SubscribeConfig>;
    }) {
        it(`ModelEventSubscriber (${settings.name}): Creation`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();
        });

        //         expect(internals.constructorAnalyzer.onSystemEventCounter)
        //             expect(internals.constructorAnalyzer.onUpdateCounter)
        //             expect(internals.constructorAnalyzer.onModelUpdateCounter)
        //             expect(internals.constructorAnalyzer.onMetaCounter)
        //             expect(internals.subscriberAnalyzer.counters.getAll)
        //             expect(internals.subscriberAnalyzer.counters.getAllIds)
        //             expect(internals.subscriberAnalyzer.counters.getById)
        //             expect(internals.subscriberAnalyzer.counters.sanitizeModel)
        it(`ModelEventSubscriber (${settings.name}): Item added (clearCreate)`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.create({ name: "test6" });
            await simpleWait(100);

            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(6);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                0,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Item added (insertData)`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.create({ name: "test6" }, true);
            await simpleWait(100);
            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }

            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }

            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);

                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                1,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Item changed (no data) (replace)`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.update(1, { name: "updated" });
            await simpleWait(100);
            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;

                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(6);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                0,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Item changed (data presented) (replace)`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.update(1, { name: "updated" }, true);
            await simpleWait(100);
            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;

                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                1,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Item changed (data presented) (merge)`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.update(
                1,
                { name: "updated" },
                true,
                true,
            );
            await simpleWait(100);
            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;

                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                1,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Item delete`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.subscriberAnalyzer.delete(1);
            await simpleWait(100);
            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                1,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                0,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): Sort change`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            internals.sortType = SORT.DESC;
            await modelEventSubscriber.regenerateIndexes();
            await simpleWait(100);

            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll({ sort: internals.sortType }),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                0,
            );
            await modelEventSubscriber.unsubscribe();
        });
        it(`ModelEventSubscriber (${settings.name}): call "regenerateIndexes" without any change`, async () => {
            const internals = getBasicInternals(settings.config);

            const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
                ...internals.subscriberSettings,
                getAll: () =>
                    internals.subscriberAnalyzer.getAll({
                        sort: internals.sortType,
                    }),
                getAllIds: () =>
                    internals.subscriberAnalyzer.getAllIds({
                        sort: internals.sortType,
                    }),
            });

            await simpleWait(200);
            expect(modelEventSubscriber).toBeDefined();

            await modelEventSubscriber.regenerateIndexes();
            await simpleWait(100);

            expect(internals.constructorAnalyzer.modelState).toEqual(
                await internals.db.getAll(),
            );

            expect(internals.constructorAnalyzer.onSystemEventCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onUpdateCounter).toEqual(2);
            expect(internals.constructorAnalyzer.onModelUpdateCounter).toEqual(
                2,
            );
            expect(internals.constructorAnalyzer.onMetaCounter).toEqual(0);
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAll,
                    ).toEqual(0);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(1);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getAllIds,
                    ).toEqual(2);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            switch (settings.name) {
                case "StrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(0);
                    break;
                case "FCRStrictSettings":
                    expect(
                        internals.subscriberAnalyzer.counters.getById,
                    ).toEqual(5);
                    break;
                default:
                    throw new Error("Unexpected settings name");
            }
            expect(internals.subscriberAnalyzer.counters.sanitizeModel).toEqual(
                0,
            );
            await modelEventSubscriber.unsubscribe();
        });
    }

    basicTests({ name: "StrictSettings", config: StrictSettings });
    basicTests({ name: "FCRStrictSettings", config: FCRStrictSettings });
});

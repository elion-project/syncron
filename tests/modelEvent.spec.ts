import { beforeEach, describe, expect, it } from "@jest/globals";
// import { ModelEvent } from "@node-elion/utils/dist/types";
import { ModelEvent } from "@node-elion/utils";

const databaseFields = [
    {
        id: 1,
        name: "test1",
    },
    {
        id: 2,
        name: "test2",
    },
    {
        id: 3,
        name: "test3",
    },
    {
        id: 4,
        name: "test4",
    },
    {
        id: 5,
        name: "test5",
    },
];

describe("ModelEventPublisher", () => {
    const modelName: string = "test";
    const generateTrackIdentifier = (action: string): string =>
        `${modelName}:${action}`;

    const generateUpdateAction = (
        pos: number,
        updateStrategy: "replace" | "merge" = "replace",
        useData = true,
    ): any => ({
        header: generateTrackIdentifier("update"),
        payload: {
            id: databaseFields[pos].id,
            ...(useData
                ? {
                      data: databaseFields[pos],
                  }
                : {
                      data: undefined,
                  }),
            updateStrategy,
        },
    });
    const generateDeleteAction = (pos: number): any => ({
        header: generateTrackIdentifier("delete"),
        payload: {
            id: databaseFields[pos].id,
        },
    });

    it("ModelEventPublisher: create", () => {
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.create(1, databaseFields[0]);
        expect(sentEvents).toEqual([generateUpdateAction(0)]);
    });

    it("ModelEventPublisher: create (Without data)", () => {
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.create(1);
        expect(sentEvents).toEqual([generateUpdateAction(0, "replace", false)]);
    });

    it("ModelEventPublisher: update", () => {
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.update(1, databaseFields[0]);
        expect(sentEvents).toEqual([generateUpdateAction(0, "merge")]);
    });

    it("ModelEventPublisher: update (Without data)", () => {
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.update(1);
        expect(sentEvents).toEqual([generateUpdateAction(0, "replace", false)]);
    });

    it("ModelEventPublisher: delete", () => {
        const sentEvents: any[] = [];
        const modelEvent = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                sentEvents.push({ header, payload });
            },
        });
        modelEvent.delete(1);
        expect(sentEvents).toEqual([generateDeleteAction(0)]);
    });
});

describe("ModelEventConstructor", () => {
    const sendEvents = (
        events: ModelEvent.ModelSubscribeEventLike[],
        modelEvent: ModelEvent.ModelEventConstructor,
        strategy: "parallel" | "sequence" = "parallel",
    ) => {
        if (strategy === "parallel") {
            modelEvent.onEvent(events);
        } else {
            events.forEach((event) => {
                modelEvent.onEvent([event]);
            });
        }
    };
    it("ModelEventConstructor: create ", () => {
        const modelEvent = new ModelEvent.ModelEventConstructor({});
        expect(modelEvent).toBeDefined();
    });

    it("ModelEventConstructor: send modelEvent (parallel)", () => {
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[0].id,
                    data: databaseFields[0],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
        ];
        let modelState: any[] = [];
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                modelState = event;
            },
        });

        sendEvents(events, modelEvent);

        expect(modelState[0]).toEqual(databaseFields[0]);
    });
    it("ModelEventConstructor: send modelEvent (sequence)", () => {
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[0].id,
                    data: databaseFields[0],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[1].id,
                    data: databaseFields[1],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 1,
                },
            },
        ];
        let modelState: any[] = [];
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                modelState = event;
            },
        });

        sendEvents(events, modelEvent, "sequence");

        expect(modelState).toEqual([databaseFields[0], databaseFields[1]]);
    });
    it("ModelEventConstructor: send modelEvent (parallel) (with double index)", () => {
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[0].id,
                    data: databaseFields[0],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[1].id,
                    data: databaseFields[1],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
        ];
        let modelState: any[] = [];
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                modelState = event;
            },
        });

        sendEvents(events, modelEvent, "parallel");

        expect(modelState).toEqual([databaseFields[1], databaseFields[0]]);
    });
    it("ModelEventConstructor: send modelEvent (sequence) (with double index)", () => {
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[0].id,
                    data: databaseFields[0],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[1].id,
                    data: databaseFields[1],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
        ];
        let modelState: any[] = [];
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                modelState = event;
            },
        });

        sendEvents(events, modelEvent, "sequence");

        expect(modelState).toEqual([databaseFields[1], databaseFields[0]]);
    });
    it("ModelEventConstructor: send metaEvent", () => {
        const testMetaData = {
            test: "test",
        };
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.META,
                data: {
                    id: "test",
                    data: testMetaData,
                },
            },
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.META,
                data: {
                    id: "test2",
                    data: testMetaData,
                },
            },
        ];
        let metaEmitted = false;
        let globalEmitted = false;
        let ModelEventEmitted = false;
        let metaState: {} = {};
        let modelState: any[] = [];
        let globalMetaState: {} = {};
        let globalModelState: any[] = [];
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onMetaUpdate: (event) => {
                metaEmitted = true;
                metaState = event;
            },
            onUpdate: (event) => {
                globalEmitted = true;
                globalMetaState = event.metadataState;
                globalModelState = event.models;
            },
            onModelUpdate: (event) => {
                ModelEventEmitted = true;
                modelState = event;
            },
        });

        sendEvents(events, modelEvent);
        expect(metaState).toEqual({
            test: testMetaData,
            test2: testMetaData,
        });
        expect(globalMetaState).toEqual(metaState);
        expect(modelState).toEqual([]);
        expect(globalModelState).toEqual(modelState);
        expect(metaEmitted).toEqual(true);
        expect(globalEmitted).toEqual(true);
        expect(ModelEventEmitted).toEqual(false);
    });
    it("ModelEventConstructor: send modelEvent and keep meta clear", () => {
        const events: ModelEvent.ModelSubscribeEventLike[] = [
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[0].id,
                    data: databaseFields[0],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 0,
                },
            },
            {
                modelName: "test",
                idParamName: "id",
                action: ModelEvent.ModelEventAction.UPDATE,
                data: {
                    id: databaseFields[1].id,
                    data: databaseFields[1],
                    updateStrategy: ModelEvent.UpdateStrategy.REPLACE,
                    index: 1,
                },
            },
        ];
        let modelState: any[] = [];
        let metaState: {} = {};
        let metaCalled = false;
        let updateCalled = false;
        let modelStateCalled = false;
        let allModelState: any[] = [];
        let allMetaState: {} = {};
        const modelEvent = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                modelStateCalled = true;
                modelState = event;
            },
            onMetaUpdate: (event) => {
                metaCalled = true;
                metaState = event;
            },
            onUpdate: (event) => {
                updateCalled = true;
                allModelState = event.models;
                allMetaState = event.metadataState;
            },
        });

        sendEvents(events, modelEvent);

        expect(modelState).toEqual([databaseFields[0], databaseFields[1]]);
        expect(allModelState).toEqual(modelState);
        expect(metaState).toEqual({});
        expect(allMetaState).toEqual(metaState);
        expect(metaCalled).toEqual(false);
        expect(updateCalled).toEqual(true);
        expect(modelStateCalled).toEqual(true);
    });
});

describe("ModelEventSubscriber", () => {
    const modelName: string = "test";
    beforeEach(() => {});

    enum SORT {
        ASC = "ASC",
        DESC = "DESC",
    }
    type DbParams = {
        id?: number[];
        name?: RegExp | string;
        sort?: SORT;
    };

    type DbModel = {
        id: number;
        name: string;
    };

    class DB {
        private databaseFields: DbModel[] = [
            {
                id: 1,
                name: "test1",
            },
            {
                id: 2,
                name: "test2",
            },
            {
                id: 3,
                name: "test3",
            },
            {
                id: 4,
                name: "test4",
            },
            {
                id: 5,
                name: "test5",
            },
        ];

        getAll(
            idOnly?: boolean,
            params?: DbParams,
        ): Promise<(DbModel | number)[]> {
            const postMapFunction = idOnly
                ? (item: DbModel) => item.id
                : (item: DbModel) => item;
            if (params) {
                const testName =
                    typeof params.name === "string"
                        ? new RegExp(params.name)
                        : params.name;
                const sortFunction: (a: DbModel, b: DbModel) => number =
                    params.sort === SORT.ASC
                        ? (a, b) => a.id - b.id
                        : (a, b) => b.id - a.id;

                return Promise.resolve(
                    this.databaseFields
                        .filter((item) => {
                            let result = true;
                            if (params.id) {
                                result = result && params.id.includes(item.id);
                            }
                            if (params.name) {
                                result = result && testName.test(item.name);
                            }
                            return result;
                        })
                        .sort(sortFunction)
                        // @ts-ignore
                        .map(postMapFunction),
                );
            }
            // @ts-ignore
            return Promise.resolve(this.databaseFields.map(postMapFunction));
        }

        getById(id: number): Promise<DbModel> {
            return Promise.resolve(
                this.databaseFields.find((item) => item.id === id),
            );
        }

        add(data?: DbModel): Promise<number> {
            const finId =
                this.databaseFields[this.databaseFields.length - 1].id + 1;
            if (data) {
                this.databaseFields.push({
                    id: finId,
                    ...data,
                });
            } else {
                this.databaseFields.push({
                    id: finId,
                    name: `test${finId}`,
                });
            }
            return Promise.resolve(finId);
        }

        remove(id: number): Promise<void> {
            this.databaseFields = this.databaseFields.filter(
                (item) => item.id !== id,
            );
            return Promise.resolve();
        }
    }

    it("ModelEventSubscriber: Missing correct indexing after manual `regenerateIndexes()`", async () => {
        const db = new DB();
        const sortType: SORT = SORT.ASC;
        let currentObjectState: DbModel[] = [];
        const trackEvent: {
            [key: string]: ModelEvent.ModelEventSubscriber["onTrackEvent"];
        } = {};

        const modelEventPublisher = new ModelEvent.ModelEventPublisher({
            modelName,
            send: (header, payload) => {
                trackEvent[header](header, payload);
            },
        });
        const modelEventConstructor = new ModelEvent.ModelEventConstructor({
            onModelUpdate: (event) => {
                // @ts-ignore
                currentObjectState = event;
            },
        });

        const modelEventSubscriber = new ModelEvent.ModelEventSubscriber({
            trackModelName: modelName,
            idParamName: "id",
            getAllIds: () =>
                db.getAll(true, { sort: sortType }) as Promise<number[]>,
            getById: (id: number) => db.getById(id),
            sanitizeModel: (body: DbModel) => Promise.resolve(body),
            track: (trackIdentifier, onTrackEvent) => {
                trackEvent[trackIdentifier] = onTrackEvent;
            },
            removeTrack: () => Promise.resolve(),
            onModelEvent: (event) => {
                // @ts-ignore
                modelEventConstructor.onEvent(event);
            },
            keepAlive: {
                onKeepAlive: () => Promise.resolve(true),
            },
        });

        const simpleWait = (time: number) =>
            new Promise((resolve) => {
                setTimeout(resolve, time);
            });

        await simpleWait(200);
        console.log(
            "currentObjectState",
            currentObjectState,
            db.getAll(true, { sort: sortType }),
        );
        await modelEventSubscriber.regenerateIndexes();
        await simpleWait(200);
        console.log(
            "currentObjectState",
            currentObjectState,
            db.getAll(true, { sort: sortType }),
        );
    });
});

// FIXME: when do rearrange
// FIXME:  When trying to add
// FIXME: Add Dumb security

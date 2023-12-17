import merge from "lodash.merge";
import {
    generateTrackIdentifier,
    getActionFromTrackIdentifier,
    IdList,
    ModelEventAction,
    ModelEventMeta,
    ModelId,
    ModelPrototype,
    ModelPublishCustomEvent,
    ModelPublishEventLike,
    ModelPublishEventLikeWithHeader,
    ModelPublishUpdateEvent,
    ModelSubscribeDeleteEvent,
    ModelSubscribeEvent,
    ModelSubscribeEventBatchSize,
    ModelSubscribeEventKeepAliveCheckPendingPeriod,
    ModelSubscribeEventKeepAlivePeriod,
    ModelSubscribeEventLike,
    ModelSubscribeEventMetaField,
    ModelSubscribeEventQueWaitTime,
    ModelSubscribeMetaEvent,
    ModelSubscriberEventFirstContentSendSize,
    ModelSubscribeUpdateEvent,
    UpdateStrategy,
    JSONLike,
    ModelSubscribeUpdateIndexEvent,
    ModelSubscribeEventMeta,
} from "./types";

export type CustomTriggerOnEmit = {
    getAll: ModelEventSubscriber["config"]["getAll"];
    getAllIds: ModelEventSubscriber["config"]["getAllIds"];
    onUpdate: ModelEventSubscriber["onUpdate"];
    modelState: Map<ModelId, ModelPrototype>;
};

export type OnEmitResponse = {
    shouldUpdateIndexes: boolean;
};

export type CustomTrigger = {
    name?: string;
    allowOptimization: boolean;
    on: (
        params: CustomTriggerOnEmit,
        data: JSONLike,
    ) => Promise<OnEmitResponse>;
};

export type CustomTriggers = {
    [key: string]: CustomTrigger;
};

export enum ModelRequestStrategy {
    "parallel",
    "sequence",
}

export type SubscribeConfig = {
    trackModelName: string;
    idParamName: string;
    getAll?: () => Promise<ModelPrototype[]>;
    modelRequest?: {
        strategy?: ModelRequestStrategy;
    };
    getAllIds: () => Promise<IdList>;
    getById: (id: ModelId) => Promise<ModelPrototype>;
    sanitizeModel: (body: ModelPrototype) => Promise<ModelPrototype>;
    track: (
        trackIdentifier: string,
        onTrackEvent: ModelEventSubscriber["onTrackEvent"],
    ) => void;
    removeTrack: (trackIdentifier: string) => Promise<void>;
    onModelEvent: (event: ModelSubscribeEvent[]) => void;
    // @description if batchSize is "auto" then batchSize will be calculated by count of available queue items. If batchSize is number, then que will wait for required count of items and then send them
    batchSize?: number | ModelSubscribeEventBatchSize;
    optimization?: {
        publisherModelEventOptimization?: boolean;
        subscriberPostModelEventOptimization?: boolean;
    };
    firstContentSend?:
        | {
              // @description used for sending first available content to constructor useful for FCR. "auto" means 10% of indexes
              size?: number | ModelSubscriberEventFirstContentSendSize;
          }
        | false;
    // @description period of time (in ms) between que checks. 100ms by default
    queWaitTime?: number | ModelSubscribeEventQueWaitTime;
    metaFields?: ModelSubscribeEventMetaField;
    customTriggers?: CustomTriggers;
    keepAlive: {
        // @description period of time (in ms) between keepAlive requests. 5000ms by default
        period?: number | ModelSubscribeEventKeepAlivePeriod;
        pendingPeriod?: number | ModelSubscribeEventKeepAliveCheckPendingPeriod;
        onKeepAlive: () => Promise<boolean>;
    };
};

export type SimpleSubscribeConfig = {
    trackName: string;
    track: (
        trackIdentifier: string,
        onTrackEvent: ModelEventSubscriber["onTrackEvent"],
    ) => void;
    removeTrack: (trackIdentifier: string) => Promise<void>;
};

type ModelSubscribeEventPerformerResponse = {
    shouldUpdateIndexes: boolean;
    newIdList?: IdList;
    __stage?: number;
};

export class ModelEventSubscriber {
    private config: Required<SubscribeConfig>;

    private queue: ModelPublishEventLikeWithHeader[] = [];

    private sendQueue: ModelSubscribeEventLike[] = [];

    private queueTimeout: NodeJS.Timeout | null = null;

    private keepAliveTimeout: NodeJS.Timeout | null = null;

    private modelState = new Map<ModelId, ModelPrototype>();

    private modelStateIndexes: IdList = [];

    private trackIdentifiers: string[] = [];

    static simpleSubscribe(
        params: SimpleSubscribeConfig,
        onEvent: (data: JSONLike) => void,
    ): { unsubscribe: () => void } {
        params.track(params.trackName, async (header, body) => {
            if (header === params.trackName) {
                onEvent(body);
            }
        });
        return {
            unsubscribe: () => params.removeTrack(params.trackName),
        };
    }

    constructor(config: SubscribeConfig) {
        this.config = {
            ...config,
            getAll:
                config.getAll ??
                (() =>
                    this.getBatchDefault.bind(this)(
                        [],
                        this.config.modelRequest.strategy,
                    )),
            modelRequest: {
                strategy:
                    config.modelRequest?.strategy ??
                    ModelRequestStrategy.parallel,
            },
            batchSize: config.batchSize || ModelSubscribeEventBatchSize.auto,
            firstContentSend:
                config.firstContentSend === false
                    ? false
                    : {
                          size:
                              config.firstContentSend?.size ||
                              ModelSubscriberEventFirstContentSendSize.auto,
                      },
            queWaitTime:
                config.queWaitTime || ModelSubscribeEventQueWaitTime.default,
            metaFields: config.metaFields || {},
            customTriggers: config.customTriggers || {},
            keepAlive: {
                period:
                    config.keepAlive.period ||
                    ModelSubscribeEventKeepAlivePeriod.default,
                pendingPeriod:
                    config.keepAlive.pendingPeriod ||
                    ModelSubscribeEventKeepAliveCheckPendingPeriod.default,
                onKeepAlive: config.keepAlive.onKeepAlive,
            },
            optimization: {
                publisherModelEventOptimization:
                    config.optimization?.publisherModelEventOptimization ??
                    true,
                subscriberPostModelEventOptimization:
                    config.optimization?.subscriberPostModelEventOptimization ??
                    true,
            },
        };
        this.init();
    }

    public async getBatchDefault(
        idList?: IdList,
        strategy?: ModelRequestStrategy,
    ) {
        let ids = idList;
        if (!idList || idList.length === 0) {
            ids = await this.config.getAllIds();
        }

        const usedStrategy = strategy || this.config.modelRequest.strategy;
        if (usedStrategy === ModelRequestStrategy.parallel) {
            return Promise.all(ids.map((id) => this.config.getById(id)));
        }

        const result: ModelPrototype[] = [];
        for (let i = 0; i < ids.length; i++) {
            result.push(await this.config.getById(ids[i]));
        }
        return result;
    }

    private generateTrackIdentifier = (action: string): string =>
        generateTrackIdentifier(this.config.trackModelName, action);

    public async init() {
        this.keepAliveTimeout = setTimeout(
            this.onKeepAliveCheck.bind(this),
            this.config.keepAlive.period,
        );

        this.trackIdentifiers = [
            this.generateTrackIdentifier(ModelEventAction.UPDATE),
            this.generateTrackIdentifier(ModelEventAction.DELETE),
            ...Object.keys(this.config.customTriggers).map((key) =>
                this.generateTrackIdentifier(key),
            ),
        ];
        this.trackIdentifiers.forEach((trackIdentifier) =>
            this.config.track(trackIdentifier, this.onTrackEvent.bind(this)),
        );

        this.pushToSendQueue(
            ...Object.entries(
                (
                    await Promise.all(
                        Object.entries(this.config.metaFields).map(
                            async ([key, item]) => [
                                key,
                                await item.onModelChange(),
                            ],
                        ),
                    )
                ).reduce((acc, [key, value]) => {
                    acc[key as string] = value;
                    return acc;
                }, {} as ModelEventMeta),
            ).map(([key, value]) => {
                const event: ModelSubscribeMetaEvent = {
                    modelName: this.config.trackModelName,
                    idParamName: this.config.idParamName,
                    action: ModelEventAction.META,
                    data: {
                        id: key,
                        data: value,
                    },
                };
                return event;
            }),
        );

        const prepareModelCreateEvent = ([id, data, index]: [
            ModelId,
            ModelPrototype,
            number,
        ]) => {
            const createEvent: ModelSubscribeUpdateEvent = {
                modelName: this.config.trackModelName,
                idParamName: this.config.idParamName,
                action: ModelEventAction.UPDATE,
                data: {
                    id,
                    data,
                    index,
                    updateStrategy: UpdateStrategy.REPLACE,
                },
            };
            return createEvent;
        };

        if (this.config.firstContentSend !== false) {
            const allIds = await this.config.getAllIds();
            const idsWithIndexes: [ModelId, number][] = allIds.map(
                (id, index) => [id, index],
            );
            const firstContentIds = idsWithIndexes.slice(
                0,
                this.config.firstContentSend.size === "auto"
                    ? Math.ceil(allIds.length / 10)
                    : this.config.firstContentSend.size,
            );

            const firstPart = await this.getBatchDefault(
                firstContentIds.map(([id]) => id),
            );
            firstContentIds.forEach(([id, posIndex], index) => {
                const item = firstPart[index];
                this.setModel(id, item, posIndex);
            });

            this.pushToSendQueue(
                ...firstContentIds
                    .map(([id, posIndex], index) => [
                        id,
                        firstPart[index],
                        posIndex,
                    ])
                    .map(prepareModelCreateEvent),
            );

            const lastPartIds = idsWithIndexes.slice(firstContentIds.length);
            if (lastPartIds.length > 0) {
                const lastPart = await this.getBatchDefault(
                    lastPartIds.map(([id]) => id),
                );
                lastPartIds.forEach(([id, posIndex], index) => {
                    const item = lastPart[index];
                    this.setModel(id, item, posIndex);
                });

                this.pushToSendQueue(
                    ...lastPartIds
                        .map(([id, posIndex], index) => [
                            id,
                            lastPart[index],
                            posIndex,
                        ])
                        .map(prepareModelCreateEvent),
                );
            }
        } else {
            const allObjects = await this.config.getAll();

            const allObjectData: [ModelId, ModelPrototype, number][] =
                allObjects.map((item, index) => [
                    (item as any)[this.config.idParamName],
                    item,
                    index,
                ]);

            allObjectData.forEach((item) => {
                this.setModel(...item);
            });

            this.pushToSendQueue(...allObjectData.map(prepareModelCreateEvent));
        }
    }

    private setModel(
        id: ModelId,
        data: ModelPrototype,
        index: number = null,
    ): void {
        this.modelState.set(id, data);
        if (index !== null) this.setIdToIndex(id, index);
    }

    private deleteModel(id: ModelId): void {
        this.modelState.delete(id);
        this.modelStateIndexes.splice(this.modelStateIndexes.indexOf(id), 1);
    }

    private setIdToIndex(id: ModelId, index: number = -1): void {
        const isModelPresent = this.modelState.has(id);
        if (!isModelPresent)
            throw new Error(`Model with id ${id} is not present in modelState`);

        const currentIndex = this.modelStateIndexes.indexOf(id);
        if (currentIndex !== -1) {
            this.modelStateIndexes.splice(currentIndex, 1);
        }
        if (index !== -1) {
            this.modelStateIndexes.push(id);
        } else {
            this.modelStateIndexes.splice(index, 0, id);
        }
    }

    private getStateIdList(): IdList {
        return this.modelStateIndexes;
    }

    private pushToQueue(...events: ModelPublishEventLikeWithHeader[]): void {
        if (events.length) {
            const currentQueLength = this.queue.length;
            const currentSendQueLength = this.sendQueue.length;
            this.queue.push(...events);
            if (currentQueLength === 0 && currentSendQueLength === 0) {
                setTimeout(this.onQueueStep.bind(this), 0);
            }
        }
    }

    private pushToSendQueue(...events: ModelSubscribeEventLike[]): void {
        if (events.length) {
            const currentQueLength = this.queue.length;
            const currentSendQueLength = this.sendQueue.length;
            this.sendQueue.push(...events);
            if (currentQueLength === 0 && currentSendQueLength === 0) {
                setTimeout(this.onQueueStep.bind(this), 0);
            }
        }
    }

    private async onKeepAliveCheck(): Promise<void> {
        const isAlive = await Promise.race([
            this.config.keepAlive.onKeepAlive(),
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve(false);
                }, this.config.keepAlive.pendingPeriod);
            }),
        ]);
        if (!isAlive) {
            await this.unsubscribe();
        } else {
            this.keepAliveTimeout = setTimeout(
                this.onKeepAliveCheck.bind(this),
                this.config.keepAlive.period,
            );
        }
    }

    private async optimizeQueue(): Promise<void> {
        (
            this.queue.reduce((acc, item, index) => {
                const itemIndex = acc.findIndex((i) => i.id === item.body.id);
                if (itemIndex === -1) {
                    return [
                        ...acc,
                        {
                            id: item.body.id,
                            actions: [
                                {
                                    name: getActionFromTrackIdentifier(
                                        item.header,
                                    ),
                                    index,
                                },
                            ],
                        },
                    ];
                }
                acc[itemIndex].actions.push({
                    name: getActionFromTrackIdentifier(item.header),
                    index,
                });
                return acc;
            }, []) as {
                id: ModelId;
                actions: {
                    name: string;
                    index: number;
                }[];
            }[]
        )
            .filter((item) => item.actions.length > 1)
            .forEach((item) => {
                if (
                    Array.from(
                        new Set(item.actions.map((action) => action.name)),
                    ).length === 1 &&
                    (this.config.customTriggers[item.actions[0].name]
                        ?.allowOptimization ||
                        !this.config.customTriggers[item.actions[0].name])
                ) {
                    item.actions.slice(0, -1).forEach((action) => {
                        this.queue.splice(action.index, 1);
                    });
                    const updateItem = item.actions.slice(-1)[0];
                    if (
                        (
                            this.queue[updateItem.index]
                                .body as ModelPublishUpdateEvent
                        ).updateStrategy === UpdateStrategy.MERGE
                    ) {
                        (
                            this.queue[updateItem.index]
                                .body as ModelPublishUpdateEvent
                        ).data = undefined;
                        (
                            this.queue[updateItem.index]
                                .body as ModelPublishUpdateEvent
                        ).updateStrategy = UpdateStrategy.REPLACE;
                    }
                } else if (
                    item.actions.some(
                        (action) => action.name === ModelEventAction.DELETE,
                    ) &&
                    !item.actions.some(
                        (action) =>
                            this.config.customTriggers[action.name]
                                ?.allowOptimization,
                    )
                ) {
                    const reverseActions = [...item.actions].reverse();
                    const currentDeleteIndex = reverseActions.findIndex(
                        (action) => action.name === ModelEventAction.DELETE,
                    );
                    const currentUpdateIndex = reverseActions.findIndex(
                        (action) => action.name !== ModelEventAction.DELETE,
                    );
                    if (currentUpdateIndex < currentDeleteIndex) {
                        // since delete is last, we can just remove all besides delete
                        reverseActions.splice(currentDeleteIndex, 1);
                        reverseActions.forEach((action) => {
                            this.queue.splice(action.index, 1);
                        });
                    } else {
                        // since update is last, we can just remove all besides update
                        const updateItem = reverseActions.splice(
                            currentUpdateIndex,
                            1,
                        );
                        if (
                            (
                                this.queue[updateItem[0].index]
                                    .body as ModelPublishUpdateEvent
                            ).updateStrategy === UpdateStrategy.MERGE
                        ) {
                            //     could cause issues if previous update was merge also
                            //     remove data and change updateStrategy to replace for right now
                            (
                                this.queue[updateItem[0].index]
                                    .body as ModelPublishUpdateEvent
                            ).data = undefined;
                            (
                                this.queue[updateItem[0].index]
                                    .body as ModelPublishUpdateEvent
                            ).updateStrategy = UpdateStrategy.REPLACE;
                        }
                        reverseActions.forEach((action) => {
                            this.queue.splice(action.index, 1);
                        });
                    }
                }
            });
    }

    private async optimizeSendQueue(): Promise<void> {
        Object.entries(
            this.sendQueue.reduce((acc, item, index) => {
                if ((acc as any)[item.data.id]) {
                    (acc as any)[item.data.id].push({ event: item, index });
                    return acc;
                }
                return { ...acc, [item.data.id]: [{ event: item, index }] };
            }, {}) as {
                [x: ModelId]: {
                    event: ModelSubscribeEventLike;
                    index: number;
                }[];
            },
        )
            .filter(([, items]) => items.length > 1)
            .forEach(([, items]) => {
                if (
                    items
                        .map((item) => item.event.action)
                        .every((action) => action === "update")
                ) {
                    items.slice(0, -1).forEach((item) => {
                        this.sendQueue.splice(item.index, 1);
                    });
                }
            });
    }

    private async updateMetaFields(
        triggers?: string[] | false,
        doPush: boolean = true,
    ): Promise<void | ModelSubscribeMetaEvent[]> {
        const doTriggerFilter = <A extends [string, any][]>(items: A) =>
            triggers
                ? items.filter(
                      ([, item]) =>
                          item.modelTriggers.some((trigger: string) =>
                              triggers.includes(trigger),
                          ) ||
                          (item.customTriggers || []).some(
                              (customTrigger: string) =>
                                  triggers.includes(customTrigger),
                          ),
                  )
                : items;

        const items = (
            await Promise.all(
                doTriggerFilter<[string, ModelSubscribeEventMeta][]>(
                    Object.entries(this.config.metaFields),
                ).map(async ([key, item]) => [key, await item.onModelChange()]),
            )
        ).map(
            ([key, value]): ModelSubscribeMetaEvent => ({
                modelName: this.config.trackModelName,
                idParamName: this.config.idParamName,
                action: ModelEventAction.META,
                data: {
                    id: key as string,
                    data: value,
                },
            }),
        );

        return doPush ? this.pushToSendQueue(...items) : items;
    }

    private async onQueueStep(): Promise<void> {
        if (this.queue.length) {
            let shouldUpdateIndexes = false;
            let newIdList: IdList = null;
            if (this.config.optimization.publisherModelEventOptimization)
                await this.optimizeQueue();
            const triggers = this.queue.map((event) =>
                getActionFromTrackIdentifier(event.header),
            );
            for (let i = 0; i < this.queue.length; i++) {
                const eventResponse = await this.performQue(
                    this.queue[i],
                    newIdList,
                );
                if (eventResponse.shouldUpdateIndexes) {
                    shouldUpdateIndexes = true;
                }
                if (eventResponse.newIdList) {
                    newIdList = eventResponse.newIdList;
                }
            }
            this.queue = [];
            if (shouldUpdateIndexes) {
                await this.findIndexDiff(newIdList);
            }

            await this.updateMetaFields(triggers);
        }

        if (this.sendQueue.length) {
            if (this.config.optimization.subscriberPostModelEventOptimization)
                await this.optimizeSendQueue();
            if (this.config.batchSize === ModelSubscribeEventBatchSize.auto) {
                this.config.onModelEvent(this.sendQueue);
                this.sendQueue = [];
            } else {
                const batch = this.sendQueue.splice(0, this.config.batchSize);
                this.config.onModelEvent(batch);
            }
        }

        if (this.queue.length || this.sendQueue.length) {
            this.queueTimeout = setTimeout(
                this.onQueueStep.bind(this),
                this.config.queWaitTime,
            );
        }
    }

    private async performQue(
        event: ModelPublishEventLikeWithHeader,
        newIdList?: IdList,
    ): Promise<ModelSubscribeEventPerformerResponse> {
        const action = getActionFromTrackIdentifier(event.header);
        const id: ModelId = (event.body as any)[this.config.idParamName];
        switch (action) {
            case ModelEventAction.UPDATE:
                return this.onUpdate(
                    id,
                    event.body as ModelPublishUpdateEvent,
                    newIdList,
                );
            case ModelEventAction.DELETE:
                return { shouldUpdateIndexes: true };
            default:
                return this.config.customTriggers[event.header].on(
                    {
                        getAll: this.config.getAll,
                        getAllIds: this.config.getAllIds,
                        onUpdate: this.onUpdate,
                        modelState: this.modelState,
                    },
                    event.body as ModelPublishCustomEvent,
                );
        }
    }

    private async onTrackEvent(
        header: string,
        body: ModelPublishEventLike,
    ): Promise<void> {
        this.pushToQueue({ header, body });
    }

    private async findIndexDiff(
        existedNewIdList?: ModelId[],
        forceMetaUpgrade: boolean = false,
    ): Promise<void> {
        const currentIdList = this.getStateIdList();
        const newIdList = existedNewIdList || (await this.config.getAllIds());

        const eventsSet = new Set<ModelEventAction>();

        const lookForData = async (id: ModelId) => {
            const model = this.modelState.get(id);
            return model || this.config.getById(id);
        };

        const updateIndexConfig = (id: ModelId, index: number) =>
            ({
                modelName: this.config.trackModelName,
                idParamName: this.config.idParamName,
                action: ModelEventAction.UPDATE_INDEX,
                data: {
                    id,
                    index,
                },
            }) as ModelSubscribeUpdateIndexEvent;

        const que = [
            ...currentIdList
                .filter((id) => !newIdList.includes(id))
                .map((id) => {
                    eventsSet.add(ModelEventAction.DELETE);
                    const deleteEvent: ModelSubscribeDeleteEvent = {
                        modelName: this.config.trackModelName,
                        idParamName: this.config.idParamName,
                        action: ModelEventAction.DELETE,
                        data: { id },
                    };
                    return deleteEvent;
                }),

            ...(await Promise.all(
                newIdList.map(async (id, index) => {
                    if (id !== currentIdList[index]) {
                        if (currentIdList.indexOf(id) !== -1) {
                            // already exists, do index update only
                            eventsSet.add(ModelEventAction.UPDATE_INDEX);
                            return updateIndexConfig(id, index);
                        }
                        const data = await lookForData(id);
                        this.setModel(id, data, index);
                        eventsSet.add(ModelEventAction.UPDATE);
                        return {
                            modelName: this.config.trackModelName,
                            idParamName: this.config.idParamName,
                            action: ModelEventAction.UPDATE,
                            data: {
                                id,
                                data,
                                index,
                                updateStrategy: UpdateStrategy.REPLACE,
                            },
                        } as ModelSubscribeUpdateEvent;
                    }
                    eventsSet.add(ModelEventAction.UPDATE_INDEX);
                    return updateIndexConfig(id, index);
                }),
            )),
            ...((await this.updateMetaFields(
                forceMetaUpgrade ? false : [...eventsSet],
                false,
            )) as ModelSubscribeMetaEvent[]),
        ];

        // remove deleted models from state
        currentIdList
            .filter((id) => !newIdList.includes(id))
            .forEach((id) => {
                this.deleteModel(id);
            });

        if (que.length) {
            this.pushToSendQueue(...que);
        }
    }

    private async onUpdate(
        id: ModelId,
        body: ModelPublishUpdateEvent,
        existedNewIdList?: IdList,
    ): Promise<ModelSubscribeEventPerformerResponse> {
        const newIdList = existedNewIdList || (await this.config.getAllIds());
        const modelHasLocal = this.modelState.has(id);
        const indexInNew = newIdList.indexOf(id);

        const updateStrategy = body.updateStrategy || "replace";
        const dataFromBody = !!(body.data as ModelPrototype);
        const data: ModelPrototype = body.data as ModelPrototype;

        if (indexInNew !== -1) {
            if (updateStrategy === UpdateStrategy.REPLACE) {
                this.setModel(
                    id,
                    dataFromBody
                        ? await this.config.sanitizeModel(data)
                        : await this.config.getById(id),
                    indexInNew,
                );
            } else if (
                updateStrategy === UpdateStrategy.MERGE &&
                body.data &&
                modelHasLocal
            ) {
                this.setModel(
                    id,
                    await this.config.sanitizeModel(
                        merge(this.modelState.get(id), data),
                    ),
                    indexInNew,
                );
            }
            this.pushToSendQueue({
                modelName: this.config.trackModelName,
                idParamName: this.config.idParamName,
                action: ModelEventAction.UPDATE,
                data: {
                    id,
                    data: this.modelState.get(id),
                    index: indexInNew,
                    updateStrategy: UpdateStrategy.REPLACE,
                },
            });
            return { shouldUpdateIndexes: true, newIdList, __stage: 1 };
        }
        if (modelHasLocal) {
            return { shouldUpdateIndexes: true, newIdList, __stage: 2 };
        }
        return { shouldUpdateIndexes: false, newIdList, __stage: 3 };
    }

    public async regenerateState(): Promise<void> {
        await this.unsubscribe();
        const currentIdList = this.getStateIdList();
        this.modelState.clear();
        this.modelStateIndexes = [];
        this.pushToSendQueue(
            ...currentIdList.map((id) => {
                const deleteEvent: ModelSubscribeDeleteEvent = {
                    modelName: this.config.trackModelName,
                    idParamName: this.config.idParamName,
                    action: ModelEventAction.DELETE,
                    data: { id },
                };
                return deleteEvent;
            }),
        );
        await this.init();
    }

    public async regenerateIndexes(
        forceMetaUpgrade: boolean = false,
    ): Promise<void> {
        await this.findIndexDiff(null, forceMetaUpgrade);
    }

    public async regenerateMeta(): Promise<void> {
        await this.updateMetaFields(false);
    }

    public async unsubscribe(): Promise<void> {
        if (this.keepAliveTimeout) clearTimeout(this.keepAliveTimeout);
        await Promise.all(
            this.trackIdentifiers.map((trackIdentifier) =>
                this.config.removeTrack(trackIdentifier),
            ),
        );
    }
}

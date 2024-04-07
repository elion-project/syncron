/* eslint-disable max-classes-per-file */
import {
    JSONLike,
    ModelEventAction,
    ModelEventMeta,
    ModelSubscribeManualUpdateEvent,
    UpdateStrategy,
    ManualUpdateTypes,
    ModelEventSubscriber,
    ModelEventPublisher,
} from "@node-elion/syncron";

export type Item = {
    id: number;
    name: string;
};

const getDefaultState = (): Item[] => [
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

export enum SORT {
    ASC = "ASC",
    DESC = "DESC",
}
export type DbParams = {
    id?: number[];
    name?: RegExp | string;
    sort?: SORT;
};

export type InsertDbModel = {
    id?: number;
    name: string;
};

class DbDriver {
    private databaseFields: Item[];

    private modelName: string;

    private idParamName: string;

    constructor(databaseFields: Item[], modelName: string) {
        this.databaseFields = databaseFields;
        this.modelName = modelName;
        this.idParamName = "id";
    }

    async getAll(): Promise<Item[]>;
    async getAll(params?: DbParams): Promise<Item[]>;
    async getAll(idOnly?: true, params?: DbParams): Promise<number[]>;

    /**
     * Get all records
     */
    async getAll(...args: any[]): Promise<Item[] | number[]> {
        const [idOnly, params] = (() => {
            if (args.length === 2) {
                return [!!args[1], (args[0] || {}) as DbParams];
            }
            if (args.length === 1 && typeof args[0] === "boolean") {
                return [args[0], {} as DbParams];
            }
            return [false, (args[0] || {}) as DbParams];
        })();
        const postMapFunction: (item: Item) => any = idOnly
            ? (item: Item) => item.id
            : (item: Item) => item;
        const filterIdFunction =
            params && params.id
                ? (item: Item) => params.id.includes(item.id)
                : () => true;
        const filterNameFunction =
            params && params.name
                ? (() => {
                      const testName =
                          typeof params.name === "string"
                              ? new RegExp(params.name)
                              : params.name;
                      return (item: Item) => testName.test(item.name);
                  })()
                : () => true;
        const sortFunction: (a: Item, b: Item) => number =
            params && params.sort === SORT.ASC
                ? (a, b) => a.id - b.id
                : (a, b) => b.id - a.id;

        return this.databaseFields
            .filter(filterIdFunction)
            .filter(filterNameFunction)
            .sort(sortFunction)
            .map(postMapFunction);
    }

    /**
     * Get record by id
     */
    get(id: number): Item {
        return this.databaseFields.find((field) => field.id === id);
    }

    /**
     * Insert new record
     */
    insert(record: InsertDbModel): Item {
        const newId =
            record.id ??
            Math.max(...this.databaseFields.map((field) => field.id), 0) + 1;

        const insertRecord = {
            id: newId,
            name: record.name,
        };
        this.databaseFields.push(insertRecord);
        return insertRecord;
    }

    presentAsUpdateAction(
        pos: number,
        updateStrategy: UpdateStrategy = UpdateStrategy.REPLACE,
        index: number = null,
        data: any = null,
    ): any {
        return {
            modelName: this.modelName,
            idParamName: this.idParamName,
            action: ModelEventAction.UPDATE,
            data: {
                id: this.databaseFields[pos].id,
                data: data || this.databaseFields[pos],
                updateStrategy,
                index: index ?? pos,
            },
        };
    }

    prepareMetaEvent(id: string, data: any): any {
        return {
            modelName: this.modelName,
            idParamName: this.idParamName,
            action: ModelEventAction.META,
            data: {
                id,
                data,
            },
        };
    }

    prepareManualUpdateEvent(id: string): ModelSubscribeManualUpdateEvent {
        return {
            modelName: this.modelName,
            idParamName: this.idParamName,
            action: ModelEventAction.MANUAL_UPDATE,
            data: {
                id: id as ManualUpdateTypes,
            },
        };
    }

    /**
     * Update existing record
     */
    update(id: number, updatedRecord: InsertDbModel) {
        const index = this.databaseFields.findIndex((field) => field.id === id);
        if (index > -1) {
            this.databaseFields[index] = {
                ...this.databaseFields[index],
                ...updatedRecord,
            };
        }
        return this.databaseFields[index];
    }

    /**
     * Delete record by id
     */
    delete(id: number) {
        const index = this.databaseFields.findIndex((field) => field.id === id);
        if (index > -1) {
            this.databaseFields.splice(index, 1);
        }
    }
}

export type BasicDbDriver = Item[] & DbDriver;
export function getDbDriver(modelName = "test"): BasicDbDriver {
    const array = getDefaultState();
    const dbDriver = new DbDriver(array, modelName);
    // @ts-ignore
    return Object.assign(array, {
        ...dbDriver,
        getAll: dbDriver.getAll.bind(dbDriver),
        get: dbDriver.get.bind(dbDriver),
        insert: dbDriver.insert.bind(dbDriver),
        update: dbDriver.update.bind(dbDriver),
        delete: dbDriver.delete.bind(dbDriver),
        presentAsUpdateAction: dbDriver.presentAsUpdateAction.bind(dbDriver),
        prepareMetaEvent: dbDriver.prepareMetaEvent.bind(dbDriver),
        prepareManualUpdateEvent:
            dbDriver.prepareManualUpdateEvent.bind(dbDriver),
    });
}

export class ModelEventConstructorAnalyzer {
    modelState: any[] = [];

    onUpdateCounter = 0;

    onModelUpdateCounter = 0;

    metaState: {} = {};

    onMetaCounter = 0;

    systemEvents: ModelSubscribeManualUpdateEvent[] = [];

    onSystemEventCounter = 0;

    constructor(private systemEventsDoPush: boolean = false) {}

    onUpdate({
        models,
        metadataState,
    }: {
        models: JSONLike[];
        metadataState: ModelEventMeta;
    }) {
        this.modelState = models;
        this.metaState = metadataState;
        this.onUpdateCounter++;
    }

    onMetaUpdate(event: ModelEventMeta) {
        this.metaState = event;
        this.onMetaCounter++;
    }

    onModelUpdate(event: JSONLike[]) {
        this.modelState = event;
        this.onModelUpdateCounter++;
    }

    onSystemEvent(events: ModelSubscribeManualUpdateEvent[]) {
        if (this.systemEventsDoPush) {
            this.systemEvents.push(...events);
        } else {
            this.systemEvents = events;
        }

        this.onSystemEventCounter++;
    }
}

export class ModelEventPublisherAnalyzer {
    sentEvents: any[] = [];

    constructor(
        public modelName: string,
        public db: BasicDbDriver,
    ) {}

    public generateTrackIdentifier(action: string): string {
        return `${this.modelName}:${action}`;
    }

    generateUpdateAction(
        itemPosition: number,
        updateStrategy: "replace" | "merge" = "replace",
        includeData = true,
    ) {
        return {
            header: this.generateTrackIdentifier("update"),
            payload: {
                id: this.db[itemPosition].id,
                ...(includeData
                    ? {
                          data: this.db[itemPosition],
                      }
                    : {}),
                updateStrategy,
            },
        };
    }

    generateDeleteAction(itemPosition: number) {
        return {
            header: this.generateTrackIdentifier("delete"),
            payload: {
                id: this.db[itemPosition].id,
            },
        };
    }
}

export class ModelEventSubscriberAnalyzer {
    public eventPublisher: ModelEventPublisher;

    public trackers: Partial<
        Record<ModelEventAction, ModelEventSubscriber["onTrackEvent"]>
    > = {};

    public counters = {
        getAll: 0,
        getAllIds: 0,
        getById: 0,
        sanitizeModel: 0,
    };

    constructor(
        public modelName: string,
        public db: BasicDbDriver,
    ) {
        this.eventPublisher = new ModelEventPublisher({
            modelName,
            send: (header: string, payload: JSONLike) => {
                Object.entries(this.trackers)
                    .filter(([key]) => header === key)
                    .forEach(([key, value]) => value(key, payload));
            },
        });
    }

    create(record: InsertDbModel, insert: boolean = false) {
        const item = this.db.insert(record);
        this.eventPublisher.create(item.id, ...[...(insert ? [item] : [])]);
    }

    update(
        id: number,
        record: InsertDbModel,
        insert: boolean = false,
        merge = false,
    ) {
        const newItem = this.db.update(id, record);
        this.eventPublisher.update(
            id,
            ...[
                ...(insert
                    ? [
                          newItem,
                          ...(merge
                              ? [UpdateStrategy.MERGE]
                              : [UpdateStrategy.REPLACE]),
                      ]
                    : []),
            ],
        );
    }

    delete(id: number) {
        this.db.delete(id);
        this.eventPublisher.delete(id);
    }

    async getAll(params: Partial<DbParams>): Promise<any[]> {
        this.counters.getAll++;
        return this.db.getAll({
            ...params,
        });
    }

    async getAllIds(params: Partial<DbParams>): Promise<number[]> {
        this.counters.getAllIds++;
        return this.db.getAll(true, {
            ...params,
        });
    }

    async getById(id: number): Promise<Item> {
        this.counters.getById++;
        return this.db.get(id);
    }

    // eslint-disable-next-line class-methods-use-this
    async sanitizeModel(model: Item): Promise<Item> {
        this.counters.sanitizeModel++;
        return model;
    }

    track(
        trackIdentifier: string,
        onTrackEvent: ModelEventSubscriber["onTrackEvent"],
    ) {
        this.trackers[trackIdentifier as ModelEventAction] = onTrackEvent;
    }

    removeTrack(trackIdentifier: string) {
        Reflect.deleteProperty(this.trackers, trackIdentifier);
    }
}

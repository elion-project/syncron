import { describe, expect, it } from "@jest/globals";
import * as ModelEvent from "@node-elion/syncron";
import { getDbDriver, ModelEventConstructorAnalyzer } from "./utils";

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
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();

        const events: ModelEvent.ModelSubscribeEventLike[] = [
            db.presentAsUpdateAction(0),
            db.presentAsUpdateAction(1),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent);

        expect(analysis.modelState[0]).toEqual(db[0]);
        expect(analysis.modelState[1]).toEqual(db[1]);
        expect(analysis.onUpdateCounter).toEqual(1);
        expect(analysis.onModelUpdateCounter).toEqual(1);
        expect(analysis.metaState).toEqual({});
        expect(analysis.onMetaCounter).toEqual(0);
        expect(analysis.systemEvents).toEqual([]);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });
    it("ModelEventConstructor: send modelEvent (sequence)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();

        const events: ModelEvent.ModelSubscribeEventLike[] = [
            db.presentAsUpdateAction(0),
            db.presentAsUpdateAction(1),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent, "sequence");

        expect(analysis.modelState[0]).toEqual(db[0]);
        expect(analysis.modelState[1]).toEqual(db[1]);
        expect(analysis.onUpdateCounter).toEqual(2);
        expect(analysis.onModelUpdateCounter).toEqual(2);
        expect(analysis.metaState).toEqual({});
        expect(analysis.onMetaCounter).toEqual(0);
        expect(analysis.systemEvents).toEqual([]);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });
    it("ModelEventConstructor: send modelEvent (parallel) (with same index)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();

        const events: ModelEvent.ModelSubscribeEventLike[] = [
            db.presentAsUpdateAction(0, undefined, 0),
            db.presentAsUpdateAction(1, undefined, 0),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent);

        expect(analysis.modelState).toEqual([db[1], db[0]]);
        expect(analysis.onUpdateCounter).toEqual(1);
        expect(analysis.onModelUpdateCounter).toEqual(1);
        expect(analysis.metaState).toEqual({});
        expect(analysis.onMetaCounter).toEqual(0);
        expect(analysis.systemEvents).toEqual([]);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });

    it("ModelEventConstructor: send modelEvent (sequence) (with same index)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();

        const events: ModelEvent.ModelSubscribeEventLike[] = [
            db.presentAsUpdateAction(0, undefined, 0),
            db.presentAsUpdateAction(1, undefined, 0),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent, "sequence");

        expect(analysis.modelState).toEqual([db[1], db[0]]);
        expect(analysis.onUpdateCounter).toEqual(2);
        expect(analysis.onModelUpdateCounter).toEqual(2);
        expect(analysis.metaState).toEqual({});
        expect(analysis.onMetaCounter).toEqual(0);
        expect(analysis.systemEvents).toEqual([]);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });
    it("ModelEventConstructor: send metaEvent (parallel)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();
        const events = [
            db.prepareMetaEvent("test", {
                test: "test",
            }),
            db.prepareMetaEvent("test2", {
                test: "test",
            }),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent);

        expect(analysis.metaState).toEqual({
            test: { test: "test" },
            test2: { test: "test" },
        });
        expect(analysis.onMetaCounter).toEqual(1);
        expect(analysis.onUpdateCounter).toEqual(1);
        expect(analysis.onModelUpdateCounter).toEqual(0);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });
    it("ModelEventConstructor: send metaEvent (sequence)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();
        const events = [
            db.prepareMetaEvent("test", {
                test: "test",
            }),
            db.prepareMetaEvent("test2", {
                test: "test",
            }),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent, "sequence");

        expect(analysis.metaState).toEqual({
            test: { test: "test" },
            test2: { test: "test" },
        });
        expect(analysis.onMetaCounter).toEqual(2);
        expect(analysis.onUpdateCounter).toEqual(2);
        expect(analysis.onModelUpdateCounter).toEqual(0);
        expect(analysis.onSystemEventCounter).toEqual(0);
    });
    it("ModelEventConstructor: send systemEvent (parallel)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();
        const events = [
            db.prepareManualUpdateEvent("test"),
            db.prepareManualUpdateEvent("test2"),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent);

        expect(analysis.systemEvents).toEqual(events);
        expect(analysis.onSystemEventCounter).toEqual(1);
        expect(analysis.onUpdateCounter).toEqual(0);
        expect(analysis.onModelUpdateCounter).toEqual(0);
        expect(analysis.onMetaCounter).toEqual(0);
    });
    it("ModelEventConstructor: send systemEvent (sequence)", () => {
        const db = getDbDriver();
        const analysis = new ModelEventConstructorAnalyzer();
        const events = [
            db.prepareManualUpdateEvent("test"),
            db.prepareManualUpdateEvent("test2"),
        ];

        const modelEvent = new ModelEvent.ModelEventConstructor({
            onUpdate: analysis.onUpdate.bind(analysis),
            onModelUpdate: analysis.onModelUpdate.bind(analysis),
            onMetaUpdate: analysis.onMetaUpdate.bind(analysis),
            onSystemEvent: analysis.onSystemEvent.bind(analysis),
        });

        sendEvents(events, modelEvent, "sequence");

        expect(analysis.systemEvents).toEqual([events[1]]);
        expect(analysis.onSystemEventCounter).toEqual(2);
        expect(analysis.onUpdateCounter).toEqual(0);
        expect(analysis.onModelUpdateCounter).toEqual(0);
        expect(analysis.onMetaCounter).toEqual(0);
    });
});

interface TrainerReference {
  id: string;
}

interface AllocationReference {
  trainer_id: string | null;
}

export function filterTrainersWithAllocations<
  Trainer extends TrainerReference,
>(
  trainers: Trainer[],
  allocations: AllocationReference[],
) {
  const allocatedTrainerIds = new Set(
    allocations.flatMap((allocation) =>
      allocation.trainer_id
        ? [allocation.trainer_id]
        : [],
    ),
  );

  return trainers.filter((trainer) =>
    allocatedTrainerIds.has(trainer.id),
  );
}

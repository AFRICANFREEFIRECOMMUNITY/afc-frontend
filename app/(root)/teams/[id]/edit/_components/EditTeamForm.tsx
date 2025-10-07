"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FullLoader, Loader } from "@/components/Loader";
import { useEffect, useState, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractSocialMediaUrls } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

//
// ✅ Schema (team_id as STRING now)
//
export const EditTeamFormSchema = z.object({
  team_id: z.string().min(1, { message: "Team id is required." }),
  team_name: z
    .string()
    .min(2, { message: "Team name must be at least 2 characters." }),
  team_logo: z.string().optional(),
  join_settings: z
    .string()
    .min(2, { message: "Join settings must be selected." }),
  facebook_url: z.string().optional(),
  twitter_url: z.string().optional(),
  instagram_url: z.string().optional(),
  youtube_url: z.string().optional(),
  twitch_url: z.string().optional(),
});

export type EditTeamFormSchemaType = z.infer<typeof EditTeamFormSchema>;

export function EditTeamForm({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [submitPending, startSubmitTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { token } = useAuth();
  const router = useRouter();

  const form = useForm<EditTeamFormSchemaType>({
    resolver: zodResolver(EditTeamFormSchema),
    defaultValues: {
      team_id: "",
      team_name: "",
      team_logo: "",
      join_settings: "",
      facebook_url: "",
      twitter_url: "",
      instagram_url: "",
      youtube_url: "",
      twitch_url: "",
    },
  });

  //
  // Fetch team details
  //
  useEffect(() => {
    if (!id) return;

    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: id }
        );
        setTeamDetails(res.data.team);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Error fetching team details"
        );
      }
    });
  }, [id]);

  //
  // Reset form when data is loaded
  //
  useEffect(() => {
    if (teamDetails) {
      const socialUrls = extractSocialMediaUrls(teamDetails.social_media_links);
      form.reset({
        team_id: String(teamDetails.team_id), // ✅ convert to string
        team_name: teamDetails.team_name || "",
        join_settings: teamDetails.join_settings || "",
        team_logo: teamDetails.team_logo || "",
        ...socialUrls,
      });
    }
  }, [teamDetails, form]);

  //
  // Submit handler
  //
  async function onSubmit(data: EditTeamFormSchemaType) {
    console.log("Submitting data:", data);

    startSubmitTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("team_id", data.team_id); // ✅ send as string
        formData.append("team_name", data.team_name);
        formData.append("join_settings", data.join_settings);

        if (selectedFile) {
          formData.append("team_logo", selectedFile);
        }

        const socialMediaLinks: Record<string, string> = {};
        if (data.facebook_url) socialMediaLinks.facebook = data.facebook_url;
        if (data.twitter_url) socialMediaLinks.twitter = data.twitter_url;
        if (data.instagram_url) socialMediaLinks.instagram = data.instagram_url;
        if (data.youtube_url) socialMediaLinks.youtube = data.youtube_url;
        if (data.twitch_url) socialMediaLinks.twitch = data.twitch_url;

        if (Object.keys(socialMediaLinks).length > 0) {
          formData.append(
            "social_media_links",
            JSON.stringify(socialMediaLinks)
          );
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/edit-team/`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.status === 200) {
          toast.success("Team updated successfully!");
          router.push(`/teams/${data.team_name}`);
        } else {
          toast.error("Oops! An error occurred");
        }
      } catch (error: any) {
        console.error(error);
        toast.error(error?.response?.data?.message || "Internal server error");
      }
    });
  }

  if (pending) return <FullLoader />;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log("Validation errors:", errors); // ✅ debug
        })}
        className="space-y-4"
      >
        {/* Team name */}
        <FormField
          control={form.control}
          name="team_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your team name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Team logo */}
        <FormField
          control={form.control}
          name="team_logo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team logo</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      field.onChange(file.name);
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Join settings */}
        <FormField
          control={form.control}
          name="join_settings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Join settings</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your settings" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="by_request">By request</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Social links */}
        <div className="space-y-2.5">
          <FormLabel>Social Media Links (Optional)</FormLabel>
          {[
            "facebook_url",
            "twitter_url",
            "instagram_url",
            "youtube_url",
            "twitch_url",
          ].map((fieldName) => (
            <FormField
              key={fieldName}
              control={form.control}
              name={fieldName as keyof EditTeamFormSchemaType}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={fieldName.replace("_url", "") + " URL"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="outline">
            <Link href={`/teams/${id}`}>Back</Link>
          </Button>
          <Button disabled={submitPending} type="submit">
            {submitPending ? <Loader text="Updating..." /> : "Update Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
